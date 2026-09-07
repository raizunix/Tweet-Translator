import type { TranslationProvider, TranslationRequest, TranslationResult } from "./types";
import { hasIntactProtectedMarkers, validateTranslation } from "./result-validation";
import { abortReason } from "./async";
import { TranslationError } from "./errors";

export const hasTranslatableText = (text: string): boolean =>
  /\p{L}/u.test(text.replace(/⟦\s*TT\s*\d+\s*⟧/giu, ""));

// Keep sentence context when the engine preserves markers. If it damages them,
// translate only prose and assemble the markers locally, never sending originals.
export async function translateProtected(
  translate: TranslationProvider["translate"],
  request: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  const result = await translate(request, signal);
  if (signal.aborted) throw abortReason(signal);
  if (typeof result?.text !== "string")
    throw new TranslationError("Invalid translation response", "invalid-result");
  if (hasIntactProtectedMarkers(request.text, result.text))
    return validateTranslation(request, result);
  const parts = request.text.split(/(⟦\s*TT\s*\d+\s*⟧)/giu);
  if (parts.length === 1) throw new TranslationError("Invalid protected text", "invalid-result");
  const translated: string[] = [];
  let detectedLanguage = result.detectedLanguage ?? request.sourceLanguage;
  for (const [index, part] of parts.entries()) {
    if (signal.aborted) throw abortReason(signal);
    if (index % 2 || !hasTranslatableText(part)) {
      translated.push(part);
      continue;
    }
    const fragment = {
      ...request,
      text: part.trim(),
      sourceLanguage: request.sourceLanguage ?? detectedLanguage
    };
    const output = validateTranslation(fragment, await translate(fragment, signal));
    if (signal.aborted) throw abortReason(signal);
    detectedLanguage ??= output.detectedLanguage;
    translated.push(part.replace(/\S[\s\S]*\S|\S/u, () => output.text.trim()));
  }
  return validateTranslation(request, { text: translated.join(""), detectedLanguage });
}
