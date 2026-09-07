import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";
import { sendTranslation } from "./runtime-client";

export class GoogleFreeTranslationProvider implements TranslationProvider {
  readonly id = "google-free";
  translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    return sendTranslation(request, signal, "TWEET_TRANSLATOR_GOOGLE_TRANSLATE");
  }
}
