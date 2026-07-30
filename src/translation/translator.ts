import type { TranslationProvider, TranslationResult } from "./types";
import { protectText } from "./text-protection";

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

  constructor(
    private readonly provider: TranslationProvider,
    private readonly timeoutMs = 8_000,
    private readonly retries = 2,
    private readonly maxCacheEntries = 200,
    private readonly cryptoTerms: readonly string[] | undefined = undefined
  ) {}

  translate(text: string, targetLanguage = "ru"): Promise<TranslationResult> {
    const normalized = normalizeText(text);
    const key = `${this.provider.id ?? "anonymous"}:${targetLanguage}:${normalized}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached);
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    const promise = this.run(normalized, targetLanguage)
      .then((result) => {
        if (this.cache.has(key)) this.cache.delete(key);
        this.cache.set(key, result);
        while (this.cache.size > this.maxCacheEntries) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cache.delete(oldest);
        }
        return result;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
  }

  private async run(text: string, targetLanguage: string): Promise<TranslationResult> {
    const protectedText = protectText(text, this.cryptoTerms);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const result = await this.provider.translate(
          { text: protectedText.text, targetLanguage },
          controller.signal
        );
        return { ...result, text: protectedText.restore(result.text) };
      } catch (error) {
        lastError = error;
        if (attempt < this.retries)
          await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof DOMException && lastError.name === "AbortError")
      throw new Error(message("translationTimeout", "Translation took too long"));
    throw lastError;
  }
}
