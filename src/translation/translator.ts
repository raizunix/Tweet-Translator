import type { TranslationProvider, TranslationResult } from "./types";

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
    private readonly retries = 2
  ) {}

  translate(text: string, targetLanguage = "ru"): Promise<TranslationResult> {
    const normalized = normalizeText(text);
    const key = `${targetLanguage}:${normalized}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const promise = this.run(normalized, targetLanguage)
      .then((result) => {
        this.cache.set(key, result);
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
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        return await this.provider.translate({ text, targetLanguage }, controller.signal);
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
