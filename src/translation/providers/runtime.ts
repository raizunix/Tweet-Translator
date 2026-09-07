import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";
import { sendTranslation } from "./runtime-client";

export class RuntimeTranslationProvider implements TranslationProvider {
  constructor(readonly id: "bing" | "tartu" | "libretranslate" | "lingva" | "apertium") {}
  translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    return sendTranslation(request, signal, "TWEET_TRANSLATOR_TRANSLATE", this.id);
  }
}
