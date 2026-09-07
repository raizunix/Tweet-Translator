import type { TranslationRequest, TranslationResult } from "./types";
import { TranslationError } from "./errors";
import { baseLanguage, detectSourceLanguage } from "./language";

export function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/⟦\s*TT\s*(\d+)\s*⟧/giu, "⟦TT$1⟧")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function isUsefulTranslation(
  request: TranslationRequest,
  result: TranslationResult
): boolean {
  if (typeof result.text !== "string" || !hasIntactProtectedMarkers(request.text, result.text))
    return false;
  const translated = normalizeComparableText(result.text);
  if (!translated) return false;
  if (translated !== normalizeComparableText(request.text)) return true;
  return (
    baseLanguage(result.detectedLanguage ?? request.sourceLanguage) ===
    baseLanguage(request.targetLanguage)
  );
}

export function validateTranslation(
  request: TranslationRequest,
  result: TranslationResult
): TranslationResult {
  if (!isUsefulTranslation(request, result))
    throw new TranslationError("Invalid translation result", "invalid-result");
  return result;
}

export async function validateOutputLanguage(
  request: TranslationRequest,
  result: TranslationResult
): Promise<TranslationResult> {
  const language = await detectSourceLanguage(result.text);
  if (language && baseLanguage(language) !== baseLanguage(request.targetLanguage))
    throw new TranslationError("The response is in a different language", "invalid-result");
  return result;
}

export function hasIntactProtectedMarkers(source: string, translated: string): boolean {
  const markers = [...source.matchAll(/⟦\s*TT\s*(\d+)\s*⟧/giu)].map((match) => match[1]);
  if (!markers.length) return true;
  const translatedMarkers = [...translated.matchAll(/⟦\s*TT\s*(\d+)\s*⟧/giu)].map(
    (match) => match[1]
  );
  return (
    markers.length === translatedMarkers.length &&
    markers.every(
      (marker) => translatedMarkers.filter((candidate) => candidate === marker).length === 1
    )
  );
}
