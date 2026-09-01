chrome.runtime.onInstalled.addListener(() => {
  // Storage defaults are merged lazily to preserve forward-compatible settings.
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

const i18nMessage = (key: string, fallback: string, substitutions?: string) =>
  chrome.i18n.getMessage(key, substitutions) || fallback;

const activeRequests = new Map<string, AbortController>();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    "type" in message &&
    message.type === "TWEET_TRANSLATOR_CANCEL" &&
    "requestId" in message &&
    typeof message.requestId === "string"
  ) {
    activeRequests.get(message.requestId)?.abort();
    activeRequests.delete(message.requestId);
    return false;
  }
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    (message.type !== "TWEET_TRANSLATOR_GOOGLE_TRANSLATE" &&
      message.type !== "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE" &&
      message.type !== "TWEET_TRANSLATOR_TRANSLATE") ||
    !("request" in message) ||
    !("requestId" in message) ||
    typeof message.requestId !== "string"
  ) {
    return false;
  }
  const request = message.request as {
    text?: unknown;
    targetLanguage?: unknown;
    sourceLanguage?: unknown;
  };
  const requestId = message.requestId;
  if (
    typeof request.text !== "string" ||
    !request.text.trim() ||
    request.text.length > 10_000 ||
    typeof request.targetLanguage !== "string"
  ) {
    sendResponse({
      ok: false,
      error: i18nMessage("invalidTranslationText", "Invalid text to translate")
    });
    return false;
  }
  if (
    message.type === "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE" &&
    new TextEncoder().encode(request.text).length > 500
  ) {
    sendResponse({ ok: false, error: "MyMemory segments must not exceed 500 bytes" });
    return false;
  }
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  if (message.type === "TWEET_TRANSLATOR_TRANSLATE") {
    if (
      !("provider" in message) ||
      !["libretranslate", "lingva", "apertium"].includes(String(message.provider))
    ) {
      activeRequests.delete(requestId);
      sendResponse({ ok: false, error: "Unknown translation provider" });
      return false;
    }
    void translateWithFreeProvider(
      message.provider as FreeProviderId,
      request as { text: string; targetLanguage: string; sourceLanguage?: string },
      controller.signal
    )
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Translation error"
          });
      })
      .finally(() => activeRequests.delete(requestId));
    return true;
  }
  if (message.type === "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE") {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.search = new URLSearchParams({
      q: request.text,
      langpair: `${typeof request.sourceLanguage === "string" ? request.sourceLanguage : "en"}|${request.targetLanguage}`
    }).toString();
    void fetch(url, { credentials: "omit", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`MyMemory is unavailable (${response.status})`);
        const data = (await response.json()) as {
          responseStatus?: number | string;
          responseDetails?: string;
          responseData?: { translatedText?: string; detectedLanguage?: string };
        };
        if (String(data.responseStatus ?? "200") !== "200" || !data.responseData?.translatedText)
          throw new Error(data.responseDetails || "MyMemory returned an invalid response");
        sendResponse({
          ok: true,
          text: decodeEntities(data.responseData.translatedText),
          detectedLanguage: data.responseData.detectedLanguage
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "MyMemory translation error"
          });
      })
      .finally(() => activeRequests.delete(requestId));
    return true;
  }
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: request.targetLanguage,
    dt: "t",
    q: request.text
  }).toString();
  void fetch(url, { signal: controller.signal })
    .then(async (response) => {
      if (response.status === 429)
        throw new Error(i18nMessage("googleRateLimit", "Google limited the request rate"));
      if (!response.ok)
        throw new Error(
          i18nMessage(
            "googleUnavailable",
            `Google Translate is unavailable (${response.status})`,
            String(response.status)
          )
        );
      const data = (await response.json()) as [Array<[string]>, null, string?];
      const text = data[0]?.map((part) => part[0]).join("");
      if (!text)
        throw new Error(i18nMessage("googleEmpty", "Google returned an empty translation"));
      sendResponse({ ok: true, text, detectedLanguage: data[2] });
    })
    .catch((error: unknown) => {
      if (!controller.signal.aborted)
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : i18nMessage("googleError", "Google Translate error")
        });
    })
    .finally(() => activeRequests.delete(requestId));
  return true;
});

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  };
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity] ?? entity);
}
import { translateWithFreeProvider, type FreeProviderId } from "./free-providers";
