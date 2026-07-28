export const TARGET_LANGUAGES = [
  "ru",
  "en",
  "es",
  "de",
  "fr",
  "pt",
  "it",
  "pl",
  "uk",
  "tr",
  "ar",
  "hi",
  "zh-CN",
  "ja",
  "ko",
  "id",
  "vi",
  "th",
  "nl",
  "he",
  "fa"
] as const;

export function getLanguageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
