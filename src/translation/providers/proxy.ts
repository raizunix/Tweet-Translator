import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

const message = (key: string, fallback: string, substitutions?: string) =>
  globalThis.chrome?.i18n?.getMessage(key, substitutions) || fallback;

export class ProxyTranslationProvider implements TranslationProvider {
  constructor(private readonly endpoint: string) {}

  async translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    if (!this.endpoint)
      throw new Error(message("proxyUrlRequired", "Configure a secure backend proxy URL"));
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal
    });
    if (response.status === 429)
      throw new Error(message("rateLimit", "Translation limit reached. Try again later"));
    if (!response.ok)
      throw new Error(
        message(
          "serviceUnavailable",
          `Translation service is unavailable (${response.status})`,
          String(response.status)
        )
      );
    const data = (await response.json()) as Partial<TranslationResult>;
    if (!data.text)
      throw new Error(message("emptyTranslation", "Translation service returned an empty result"));
    return { text: data.text, detectedLanguage: data.detectedLanguage };
  }
}
