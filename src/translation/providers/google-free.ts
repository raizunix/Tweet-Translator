import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

const message = (key: string, fallback: string) =>
  globalThis.chrome?.i18n?.getMessage(key) || fallback;

interface GoogleTranslateResponse {
  ok: boolean;
  text?: string;
  detectedLanguage?: string;
  error?: string;
}

export class GoogleFreeTranslationProvider implements TranslationProvider {
  readonly id = "google-free";
  async translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.id || typeof runtime.sendMessage !== "function") {
      throw new Error(message("reloadPage", "The extension was updated — reload the page"));
    }
    return await new Promise<TranslationResult>((resolve, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      runtime.sendMessage(
        { type: "TWEET_TRANSLATOR_GOOGLE_TRANSLATE", request },
        (response: GoogleTranslateResponse | undefined) => {
          signal.removeEventListener("abort", abort);
          if (signal.aborted) return;
          if (runtime.lastError) {
            reject(
              new Error(
                message("serviceConnectionFailed", "Could not connect to the translation service")
              )
            );
            return;
          }
          if (!response?.ok || !response.text) {
            reject(
              new Error(
                response?.error ||
                  message(
                    "googleTemporarilyUnavailable",
                    "Google Translate is temporarily unavailable"
                  )
              )
            );
            return;
          }
          resolve({ text: response.text, detectedLanguage: response.detectedLanguage });
        }
      );
    });
  }
}
