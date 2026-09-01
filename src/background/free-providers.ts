import type { TranslationRequest, TranslationResult } from "../translation/types";

export type FreeProviderId = "libretranslate" | "lingva" | "apertium";

const LIBRE_TRANSLATE_INSTANCES = [
  "https://libretranslate.de",
  "https://translate.mentality.rip",
  "https://translate.api.skitzen.com",
  "https://trans.zillyhuhn.com",
  "https://libretranslate.pussthecat.org"
];

const LINGVA_INSTANCES = [
  "https://lingva.ml",
  "https://translate.plausibility.cloud",
  "https://lingva.lunar.icu",
  "https://translate.projectsegfau.lt",
  "https://translate.dr460nf1r3.org",
  "https://lingva.garudalinux.org",
  "https://translate.jae.fi"
];

export async function translateWithFreeProvider(
  provider: FreeProviderId,
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  if (provider === "libretranslate") return translateWithLibreTranslate(request, signal);
  if (provider === "lingva") return translateWithLingva(request, signal);
  return translateWithApertium(request, signal);
}

async function translateWithLibreTranslate(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  return raceInstances(LIBRE_TRANSLATE_INSTANCES, signal, async (instance, instanceSignal) => {
    const response = await fetch(`${instance}/translate`, {
      method: "POST",
      credentials: "omit",
      signal: instanceSignal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: request.text,
        source: request.sourceLanguage ?? "auto",
        target: request.targetLanguage,
        format: "text"
      })
    });
    const data = (await response.json()) as {
      translatedText?: string;
      detectedLanguage?: { language?: string };
      error?: string;
    };
    if (!response.ok || !data.translatedText)
      throw new Error(data.error || `LibreTranslate returned ${response.status}`);
    return {
      text: data.translatedText,
      detectedLanguage: data.detectedLanguage?.language
    };
  });
}

async function translateWithLingva(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  return raceInstances(LINGVA_INSTANCES, signal, async (instance, instanceSignal) => {
    const source = request.sourceLanguage ?? "auto";
    const path = [source, request.targetLanguage, request.text].map(encodeURIComponent).join("/");
    const response = await fetch(`${instance}/api/v1/${path}`, {
      credentials: "omit",
      signal: instanceSignal
    });
    const data = (await response.json()) as { translation?: string; error?: string };
    if (!response.ok || !data.translation)
      throw new Error(data.error || `Lingva returned ${response.status}`);
    return { text: data.translation };
  });
}

async function translateWithApertium(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  const source = toApertiumCode(request.sourceLanguage ?? "en");
  const target = toApertiumCode(request.targetLanguage);
  const url = new URL("https://beta.apertium.org/apy/translate");
  url.search = new URLSearchParams({
    q: request.text,
    langpair: `${source}|${target}`,
    markUnknown: "no"
  }).toString();
  const response = await fetchWithTimeout(url, { credentials: "omit", signal }, 3_000);
  const data = (await response.json()) as {
    responseStatus?: number;
    responseDetails?: string;
    responseData?: { translatedText?: string };
  };
  if (!response.ok || data.responseStatus !== 200 || !data.responseData?.translatedText)
    throw new Error(data.responseDetails || "Apertium does not support this language pair");
  return { text: data.responseData.translatedText, detectedLanguage: request.sourceLanguage };
}

async function raceInstances<T>(
  instances: readonly string[],
  parentSignal: AbortSignal,
  request: (instance: string, signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (parentSignal.aborted) throw new DOMException("Aborted", "AbortError");
  const controllers = instances.map(() => new AbortController());
  const abortAll = () => controllers.forEach((controller) => controller.abort());
  parentSignal.addEventListener("abort", abortAll, { once: true });
  try {
    const winner = await Promise.any(
      instances.map(async (instance, index) => ({
        index,
        value: await withTimeout(
          controllers[index],
          2_500,
          (signal) => request(instance, signal),
          `${instance} timed out`
        )
      }))
    );
    controllers.forEach((controller, index) => {
      if (index !== winner.index) controller.abort();
    });
    return winner.value;
  } catch (error) {
    if (parentSignal.aborted) throw new DOMException("Aborted", "AbortError");
    if (error instanceof AggregateError)
      throw error.errors.find((item) => item instanceof Error) ?? error;
    throw error;
  } finally {
    parentSignal.removeEventListener("abort", abortAll);
  }
}

async function fetchWithTimeout(
  input: URL | string,
  init: RequestInit & { signal: AbortSignal },
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal.addEventListener("abort", abort, { once: true });
  try {
    return await withTimeout(
      controller,
      timeoutMs,
      (signal) => fetch(input, { ...init, signal }),
      "Translation service timed out"
    );
  } finally {
    init.signal.removeEventListener("abort", abort);
  }
}

async function withTimeout<T>(
  controller: AbortController,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMessage: string
): Promise<T> {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (timedOut) throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toApertiumCode(language: string): string {
  const codes: Record<string, string> = {
    ar: "ara",
    be: "bel",
    bg: "bul",
    ca: "cat",
    cs: "ces",
    de: "deu",
    en: "eng",
    es: "spa",
    fi: "fin",
    fr: "fra",
    hi: "hin",
    it: "ita",
    kk: "kaz",
    nl: "nld",
    pl: "pol",
    pt: "por",
    ru: "rus",
    sv: "swe",
    tr: "tur",
    uk: "ukr"
  };
  const base = language.toLowerCase().split("-")[0];
  return codes[base] ?? base;
}
