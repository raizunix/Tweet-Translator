import type { TranslationRequest, TranslationResult } from "../types";
import { TranslationError, type TranslationErrorCode } from "../errors";
import { abortReason } from "../async";

interface RuntimeResponse extends Partial<TranslationResult> {
  ok?: boolean;
  error?: string;
  code?: TranslationErrorCode;
  retryAfterMs?: number;
}

export function sendTranslation(
  request: TranslationRequest,
  signal: AbortSignal,
  type: string,
  provider?: string
): Promise<TranslationResult> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.id || typeof runtime.sendMessage !== "function")
    return Promise.reject(
      new TranslationError("Reload the page to reconnect to the extension", "invalid-request")
    );
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(abortReason(signal));
      try {
        runtime.sendMessage({ type: "TWEET_TRANSLATOR_CANCEL", requestId }, () => {
          void runtime.lastError;
        });
      } catch {
        /* The extension may have been reloaded while cancelling. */
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      runtime.sendMessage(
        { type, provider, request, requestId },
        (response: RuntimeResponse | undefined) => {
          signal.removeEventListener("abort", abort);
          const runtimeError = runtime.lastError;
          if (signal.aborted) return;
          if (
            runtimeError ||
            !response?.ok ||
            typeof response.text !== "string" ||
            !response.text
          ) {
            reject(
              new TranslationError(
                response?.error || "Translation service unavailable",
                response?.code ?? "network",
                response?.retryAfterMs
              )
            );
            return;
          }
          resolve({ text: response.text, detectedLanguage: response.detectedLanguage });
        }
      );
    } catch (error) {
      signal.removeEventListener("abort", abort);
      reject(error);
    }
  });
}
