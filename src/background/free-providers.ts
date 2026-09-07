import type { TranslationRequest, TranslationResult } from "../translation/types";
import { fetchJson, fetchAndRead } from "./http";
import { TranslationError, raceError } from "../translation/errors";
import { abortReason, withDeadline, waitWithSignal } from "../translation/async";
import { translateProtected } from "../translation/protected-request";

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
  let data: Array<{
    detectedLanguage?: { language?: string };
    translations?: Array<{ text?: string }>;
  }>;
  try {
    data = await fetchJson(
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
  } catch (error) {
    if (!retried && error instanceof TranslationError && error.code === "auth") {
      bingAuth = undefined;
      return translateWithBing(request, signal, true);
    }
    throw error;
  }
  const text = data[0]?.translations?.[0]?.text;
  if (!text) throw new TranslationError("Bing returned an empty translation", "invalid-result");
  return { text, detectedLanguage: data[0]?.detectedLanguage?.language };
}

async function getBingAuth(signal: AbortSignal, force: boolean): Promise<BingAuth> {
  if (!force && bingAuth && bingAuth.expiresAt > Date.now() + 30_000) return bingAuth;
  const html = await fetchAndRead(
    "https://www.bing.com/translator",
    { credentials: "omit", signal },
    5_000,
    (response) => response.text()
  );
  const ig = /IG:"([^"]+)"/.exec(html);
  const iid = /data-iid="([^"]+)"/.exec(html);
  const params =
    /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]/.exec(html);
  if (!ig || !params) throw new TranslationError("Bing authentication parameters changed", "auth");
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
  if (!request.sourceLanguage)
    throw new TranslationError("TartuNLP requires a detected source language", "unsupported");
  const source = toTartuCode(request.sourceLanguage);
  const target = toTartuCode(request.targetLanguage);
  const config = await getCapabilities<{ domains: Array<{ code: string; languages: string[] }> }>(
    "https://api.tartunlp.ai/translation/v2",
    signal
  );
  if (
    !config.domains
      ?.find((domain) => domain.code === "general")
      ?.languages?.includes(`${source}-${target}`)
  )
    throw new TranslationError("TartuNLP does not support this language pair", "unsupported");
  const data = await fetchJson<{ result?: string | string[] }>(
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
  const text = Array.isArray(data.result) ? data.result.join("") : data.result;
  if (!text) throw new TranslationError("TartuNLP returned an empty translation", "invalid-result");
  return { text, detectedLanguage: request.sourceLanguage };
}

async function translateWithLibreTranslate(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  return raceInstances(LIBRE_TRANSLATE_INSTANCES, signal, async (instance, instanceSignal) =>
    translateProtected(
      async (fragment, fragmentSignal) => {
        const languages = await getCapabilities<Array<{ code: string; targets?: string[] }>>(
          `${instance}/languages`,
          fragmentSignal
        );
        const target = request.targetLanguage.toLowerCase().split("-")[0];
        const source = request.sourceLanguage?.toLowerCase().split("-")[0];
        if (
          !languages.some((language) => language.code === target) ||
          (source &&
            !languages.some(
              (language) =>
                language.code === source && (!language.targets || language.targets.includes(target))
            ))
        )
          throw new TranslationError(
            "LibreTranslate does not support this language pair",
            "unsupported"
          );
        const data = await fetchJson<{
          translatedText?: string;
          detectedLanguage?: { language?: string };
          error?: string;
        }>(`${instance}/translate`, {
          method: "POST",
          credentials: "omit",
          signal: fragmentSignal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: fragment.text,
            source: source ?? "auto",
            target,
            format: "text"
          })
        });
        if (!data.translatedText)
          throw new TranslationError(
            data.error || "LibreTranslate returned an empty translation",
            "invalid-result"
          );
        return {
          text: data.translatedText,
          detectedLanguage: data.detectedLanguage?.language
        };
      },
      request,
      instanceSignal
    )
  );
}

async function translateWithLingva(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  return raceInstances(LINGVA_INSTANCES, signal, async (instance, instanceSignal) =>
    translateProtected(
      async (fragment, fragmentSignal) => {
        const source = fragment.sourceLanguage ?? "auto";
        const path = [source, fragment.targetLanguage, fragment.text]
          .map(encodeURIComponent)
          .join("/");
        const data = await fetchJson<{ translation?: string; error?: string }>(
          `${instance}/api/v1/${path}`,
          {
            credentials: "omit",
            signal: fragmentSignal
          }
        );
        if (!data.translation)
          throw new TranslationError(
            data.error || "Lingva returned an empty translation",
            "invalid-result"
          );
        return { text: data.translation };
      },
      request,
      instanceSignal
    )
  );
}

async function translateWithApertium(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  if (!request.sourceLanguage)
    throw new TranslationError("Apertium requires a detected source language", "unsupported");
  const source = toApertiumCode(request.sourceLanguage);
  const target = toApertiumCode(request.targetLanguage);
  const pairs = await getCapabilities<{
    responseData: Array<{ sourceLanguage: string; targetLanguage: string }>;
  }>("https://beta.apertium.org/apy/listPairs", signal);
  if (
    !pairs.responseData?.some(
      (pair) =>
        toApertiumCode(pair.sourceLanguage) === source &&
        toApertiumCode(pair.targetLanguage) === target
    )
  )
    throw new TranslationError("Apertium does not support this language pair", "unsupported");
  const url = new URL("https://beta.apertium.org/apy/translate");
  url.search = new URLSearchParams({
    q: request.text,
    langpair: `${source}|${target}`,
    markUnknown: "no"
  }).toString();
  const data = await fetchJson<{
    responseStatus?: number;
    responseDetails?: string;
    responseData?: { translatedText?: string };
  }>(url, { credentials: "omit", signal }, 3_000);
  if (data.responseStatus !== 200 || !data.responseData?.translatedText)
    throw new TranslationError(
      data.responseDetails || "Apertium does not support this language pair",
      "unsupported"
    );
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
          value: await withDeadline(controllers[index].signal, 5_000, (signal) =>
            request(instance, signal)
          )
        };
      })
    );
    controllers.forEach((controller, index) => {
      if (index !== winner.index) controller.abort();
    });
    return winner.value;
  } catch (error) {
    if (parentSignal.aborted) throw abortReason(parentSignal);
    if (error instanceof AggregateError) throw raceError(error.errors) ?? error;
    throw error;
  } finally {
    parentSignal.removeEventListener("abort", abortAll);
  }
}

const capabilities = new Map<string, { value: unknown; expires: number }>();
async function getCapabilities<T>(url: string, signal: AbortSignal): Promise<T> {
  const cached = capabilities.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const value = await fetchJson<T>(url, { signal }, 3000);
  capabilities.set(url, { value, expires: Date.now() + 3_600_000 });
  return value;
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
