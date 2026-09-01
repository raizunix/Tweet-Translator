import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

interface RuntimeResponse extends Partial<TranslationResult> {
  ok?: boolean;
  error?: string;
}

export class RuntimeTranslationProvider implements TranslationProvider {
  constructor(readonly id: "libretranslate" | "lingva" | "apertium") {}

  translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.id || typeof runtime.sendMessage !== "function")
      return Promise.reject(new Error(`Could not connect to ${this.id}`));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const abort = () => {
        runtime.sendMessage({ type: "TWEET_TRANSLATOR_CANCEL", requestId });
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      runtime.sendMessage(
        { type: "TWEET_TRANSLATOR_TRANSLATE", provider: this.id, request, requestId },
        (response: RuntimeResponse | undefined) => {
          signal.removeEventListener("abort", abort);
          if (signal.aborted) return;
          if (runtime.lastError || !response?.ok || !response.text) {
            reject(new Error(response?.error || `${this.id} is temporarily unavailable`));
            return;
          }
          resolve({ text: response.text, detectedLanguage: response.detectedLanguage });
        }
      );
    });
  }
}
