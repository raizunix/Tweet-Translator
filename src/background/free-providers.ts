import type { TranslationRequest, TranslationResult } from "../translation/types";

export type FreeProviderId = "bing" | "tartu" | "libretranslate" | "lingva" | "apertium";

interface BingAuth {
  ig: string;
  iid: string;
  key: string;
  token: string;
  expiresAt: number;
}

let bingAuth: BingAuth | undefined;

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
  if (provider === "bing") return translateWithBing(request, signal);
  if (provider === "tartu") return translateWithTartu(request, signal);
  if (provider === "libretranslate") return translateWithLibreTranslate(request, signal);
  if (provider === "lingva") return translateWithLingva(request, signal);
  return translateWithApertium(request, signal);
}

async function translateWithBing(
  request: TranslationRequest,
  signal: AbortSignal,
  retried = false
): Promise<TranslationResult> {
  const auth = await getBingAuth(signal, retried);
  const url = new URL("https://www.bing.com/ttranslatev3");
  url.search = new URLSearchParams({ isVertical: "1", IG: auth.ig, IID: auth.iid }).toString();
  const body = new URLSearchParams({
    fromLang: request.sourceLanguage ?? "auto-detect",
    to: toBingCode(request.targetLanguage),
    text: request.text,
    token: auth.token,
    key: auth.key
  });
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    },
    5_000
  );
  const data = (await response.json()) as Array<{
    detectedLanguage?: { language?: string };
    translations?: Array<{ text?: string }>;
  }>;
  const text = data[0]?.translations?.[0]?.text;
  if (!response.ok || !text) {
    if (!retried) {
      bingAuth = undefined;
      return translateWithBing(request, signal, true);
    }
    throw new Error(`Bing returned ${response.status}`);
  }
  return { text, detectedLanguage: data[0]?.detectedLanguage?.language };
}

async function getBingAuth(signal: AbortSignal, force: boolean): Promise<BingAuth> {
  if (!force && bingAuth && bingAuth.expiresAt > Date.now() + 30_000) return bingAuth;
  const response = await fetchWithTimeout(
    "https://www.bing.com/translator",
    { credentials: "omit", signal },
    5_000
  );
  if (!response.ok) throw new Error(`Bing auth returned ${response.status}`);
  const html = await response.text();
  const ig = /IG:"([^"]+)"/.exec(html);
  const iid = /data-iid="([^"]+)"/.exec(html);
  const params =
    /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]/.exec(html);
  if (!ig || !params) throw new Error("Bing authentication parameters changed");
  bingAuth = {
    ig: ig[1],
    iid: iid?.[1] ?? "translator.5028",
    key: params[1],
    token: params[2],
    expiresAt: Date.now() + (Number(params[3]) || 3_600_000)
  };
  return bingAuth;
}

async function translateWithTartu(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  const source = toTartuCode(request.sourceLanguage ?? "en");
  const target = toTartuCode(request.targetLanguage);
  const response = await fetchWithTimeout(
    "https://api.tartunlp.ai/translation/v2",
    {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: request.text,
        src: source,
        tgt: target,
        domain: "general",
        application: "Tweet Translator"
      })
    },
    6_000
  );
  const data = (await response.json()) as { result?: string | string[]; detail?: unknown };
  const text = Array.isArray(data.result) ? data.result.join("") : data.result;
  if (!response.ok || !text) throw new Error(`TartuNLP returned ${response.status}`);
  return { text, detectedLanguage: request.sourceLanguage ?? "en" };
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
      instances.map(async (instance, index) => {
        await waitWithSignal(index * 300, controllers[index].signal);
        return {
          index,
          value: await withTimeout(
            controllers[index],
            2_500,
            (signal) => request(instance, signal),
            `${instance} timed out`
          )
        };
      })
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

function waitWithSignal(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
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

function toBingCode(language: string): string {
  const normalized = language.toLowerCase();
  if (["zh", "zh-cn", "zh-hans"].includes(normalized)) return "zh-Hans";
  if (["zh-tw", "zh-hant"].includes(normalized)) return "zh-Hant";
  return language;
}

function toTartuCode(language: string): string {
  const codes: Record<string, string> = {
    ar: "ara",
    bg: "bul",
    cs: "ces",
    de: "ger",
    en: "eng",
    es: "spa",
    et: "est",
    fi: "fin",
    fr: "fra",
    it: "ita",
    lv: "lav",
    lt: "lit",
    pl: "pol",
    pt: "por",
    ru: "rus",
    sv: "swe",
    uk: "ukr"
  };
  const base = language.toLowerCase().split("-")[0];
  return codes[base] ?? base;
}
