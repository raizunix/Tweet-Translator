import { sendTranslation } from "./runtime-client";
import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

export class MyMemoryTranslationProvider implements TranslationProvider {
  readonly id = "mymemory";

  async translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    const chunks = splitUtf8(request.text, 500);
    const results: TranslationResult[] = [];
    for (const text of chunks) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      results.push(await send({ ...request, text }, signal));
    }
    return {
      text: results.map((result) => result.text).join(""),
      detectedLanguage: results.find((result) => result.detectedLanguage)?.detectedLanguage
    };
  }
}

async function send(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
  return sendTranslation(request, signal, "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE");
}

export function splitUtf8(text: string, maxBytes: number): string[] {
  if (maxBytes < 1) throw new Error("maxBytes must be positive");
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  const units = text.match(/⟦TT\d+⟧|[\s\S]/gu) ?? [];
  for (const unit of units) {
    if (encoder.encode(unit).length > maxBytes)
      throw new Error("A character exceeds the segment byte limit");
    if (encoder.encode(chunk + unit).length > maxBytes) {
      chunks.push(chunk);
      chunk = unit;
    } else {
      chunk += unit;
    }
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}
