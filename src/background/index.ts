import { translateWithFreeProvider, type FreeProviderId } from "./free-providers";
import { fetchJson, httpError } from "./http";
import { requestScheduler } from "./request-scheduler";
import { TranslationError } from "../translation/errors";
import type { TranslationRequest, TranslationResult } from "../translation/types";

chrome.runtime.onInstalled.addListener(() => {
  // Storage defaults are merged lazily to preserve forward-compatible settings.
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

const activeRequests = new Map<string, AbortController>();
const freeProviders = ["bing", "tartu", "libretranslate", "lingva", "apertium"];

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    !("requestId" in message) ||
    typeof message.requestId !== "string"
  )
    return false;
  const key = [sender.tab?.id ?? "extension", sender.frameId ?? 0, message.requestId].join(":");
  if (message.type === "TWEET_TRANSLATOR_CANCEL") {
    activeRequests.get(key)?.abort();
    return false;
  }
  if (
    ![
      "TWEET_TRANSLATOR_GOOGLE_TRANSLATE",
      "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE",
      "TWEET_TRANSLATOR_TRANSLATE"
    ].includes(String(message.type))
  )
    return false;
  const request =
    "request" in message ? (message.request as Partial<TranslationRequest> | null) : null;
  if (
    !request ||
    typeof request.text !== "string" ||
    !request.text.trim() ||
    request.text.length > 10_000 ||
    typeof request.targetLanguage !== "string" ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(request.targetLanguage) ||
    (request.sourceLanguage !== undefined &&
      (typeof request.sourceLanguage !== "string" ||
        !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(request.sourceLanguage)))
  ) {
    sendResponse({ ok: false, error: "Invalid translation request", code: "invalid-request" });
    return false;
  }
  const provider =
    message.type === "TWEET_TRANSLATOR_GOOGLE_TRANSLATE"
      ? "google"
      : message.type === "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE"
        ? "mymemory"
        : "provider" in message
          ? String(message.provider)
          : "";
  if (!["google", "mymemory", ...freeProviders].includes(provider) || activeRequests.has(key)) {
    sendResponse({
      ok: false,
      error: "Invalid provider or duplicate request",
      code: "invalid-request"
    });
    return false;
  }
  const controller = new AbortController();
  activeRequests.set(key, controller);
  const input = request as TranslationRequest;
  const operation =
    provider === "google"
      ? translateGoogle(input, controller.signal)
      : provider === "mymemory"
        ? translateMyMemory(input, controller.signal)
        : translateWithFreeProvider(provider as FreeProviderId, input, controller.signal);
  void operation
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Translation error",
        code: error instanceof TranslationError ? error.code : "network",
        retryAfterMs: error instanceof TranslationError ? error.retryAfterMs : undefined
      });
    })
    .finally(() => activeRequests.delete(key));
  return true;
});

async function translateGoogle(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({
    client: "gtx",
    sl: request.sourceLanguage ?? "auto",
    tl: request.targetLanguage,
    dt: "t",
    q: request.text
  }).toString();
  const data = await fetchJson<[Array<[string]>, null, string?]>(url, { signal });
  const text = data[0]?.map((part) => part[0]).join("");
  if (!text) throw new TranslationError("Google returned an empty translation", "invalid-result");
  return { text, detectedLanguage: data[2] };
}

async function translateMyMemory(
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  if (new TextEncoder().encode(request.text).length > 500)
    throw new TranslationError("MyMemory segments must not exceed 500 bytes", "invalid-request");
  const url = new URL("https://api.mymemory.translated.net/get");
  url.search = new URLSearchParams({
    q: request.text,
    langpair: (request.sourceLanguage ?? "autodetect") + "|" + request.targetLanguage
  }).toString();
  const data = await fetchJson<{
    responseStatus?: number | string;
    responseDetails?: string;
    quotaFinished?: boolean;
    responseData?: { translatedText?: string; detectedLanguage?: string };
  }>(url, { signal });
  const status = Number(data.responseStatus ?? 200);
  if (data.quotaFinished || status === 429) {
    requestScheduler.defer(url.origin, 60_000);
    throw new TranslationError(
      data.responseDetails || "MyMemory quota exhausted",
      "rate-limit",
      60_000
    );
  }
  if (status !== 200) throw httpError(status);
  if (!data.responseData?.translatedText)
    throw new TranslationError("MyMemory returned an empty translation", "invalid-result");
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  };
  return {
    text: data.responseData.translatedText.replace(
      /&(?:amp|lt|gt|quot|#39);/g,
      (entity) => entities[entity] ?? entity
    ),
    detectedLanguage: data.responseData.detectedLanguage
  };
}
