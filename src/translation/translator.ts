import type { TranslationProvider, TranslationResult } from "./types";
import { protectText } from "./text-protection";
import { normalizeComparableText } from "./result-validation";
import { translateProtected, hasTranslatableText } from "./protected-request";
import { baseLanguage, detectSourceLanguage } from "./language";
import { withDeadline } from "./async";
import { canRetry, TranslationError } from "./errors";

const message = (key: string, fallback: string) =>
  globalThis.chrome?.i18n?.getMessage(key) || fallback;

export function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class Translator {
  private readonly cache = new Map<string, TranslationResult>();
  private readonly pending = new Map<string, Promise<TranslationResult>>();
  private readonly latest = new Map<string, object>();

  constructor(
    private readonly provider: TranslationProvider,
    private readonly timeoutMs = 8_000,
    private readonly retries = 2,
    private readonly maxCacheEntries = 200,
    private readonly cryptoTerms: readonly string[] | undefined = undefined
  ) {}

  translate(text: string, targetLanguage = "ru", force = false): Promise<TranslationResult> {
    const normalized = normalizeText(text);
    const key = `${this.provider.id ?? "anonymous"}:${targetLanguage}:${normalized}`;
    const cached = force ? undefined : this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached);
    }
    const existing = force ? undefined : this.pending.get(key);
    if (existing) return existing;
    const operation = {};
    this.latest.set(key, operation);
    const promise = this.run(normalized, targetLanguage)
      .then((result) => {
        if (this.latest.get(key) !== operation) return result;
        if (this.cache.has(key)) this.cache.delete(key);
        this.cache.set(key, result);
        while (this.cache.size > this.maxCacheEntries) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cache.delete(oldest);
        }
        return result;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
        if (this.latest.get(key) === operation) this.latest.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.latest.clear();
  }

  private async run(text: string, targetLanguage: string): Promise<TranslationResult> {
    const protectedText = protectText(text, this.cryptoTerms);
    if (!hasTranslatableText(protectedText.text)) return { text };
    const sourceLanguage = await detectSourceLanguage(text);
    if (sourceLanguage && baseLanguage(sourceLanguage) === baseLanguage(targetLanguage))
      return { text, detectedLanguage: sourceLanguage };
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      try {
        const result = await withDeadline(controller.signal, this.timeoutMs, (signal) =>
          translateProtected(
            this.provider.translate.bind(this.provider),
            { text: protectedText.text, targetLanguage, sourceLanguage },
            signal
          )
        );
        const restored = protectedText.restore(result.text);
        if (
          normalizeComparableText(restored) === normalizeComparableText(text) &&
          result.detectedLanguage?.toLowerCase().split("-")[0] !==
            targetLanguage.toLowerCase().split("-")[0]
        ) {
          throw new TranslationError(
            message("translationFailed", "Could not translate"),
            "invalid-result"
          );
        }
        return { ...result, text: restored };
      } catch (error) {
        lastError = error;
        if (!canRetry(error)) break;
        if (attempt < this.retries)
          await new Promise((resolve) =>
            setTimeout(resolve, 350 * 3 ** attempt + Math.random() * 250)
          );
      }
    }
    if (lastError instanceof TranslationError && lastError.code === "timeout")
      throw new Error(message("translationTimeout", "Translation took too long"));
    throw new Error(message("translationFailed", "Could not translate"), { cause: lastError });
  }
}
