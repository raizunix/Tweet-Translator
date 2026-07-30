import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

interface MyMemoryResponse {
  ok?: boolean;
  text?: string;
  detectedLanguage?: string;
  error?: string;
}

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
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.id || typeof runtime.sendMessage !== "function")
    throw new Error("Could not connect to MyMemory");
  return await new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    runtime.sendMessage(
      { type: "TWEET_TRANSLATOR_MYMEMORY_TRANSLATE", request },
      (response: MyMemoryResponse | undefined) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) return;
        if (runtime.lastError || !response?.ok || !response.text) {
          reject(new Error(response?.error || "MyMemory is temporarily unavailable"));
          return;
        }
        resolve({ text: response.text, detectedLanguage: response.detectedLanguage });
      }
    );
  });
}

export function splitUtf8(text: string, maxBytes: number): string[] {
  if (maxBytes < 1) throw new Error("maxBytes must be positive");
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  const units = text.match(/⟦TT\d+⟧|./gu) ?? [];
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
