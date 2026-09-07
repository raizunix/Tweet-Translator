export const baseLanguage = (language?: string): string | undefined =>
  language?.toLowerCase().split("-")[0];

export async function detectSourceLanguage(text: string): Promise<string | undefined> {
  const detect = globalThis.chrome?.i18n?.detectLanguage;
  if (!detect) return undefined;
  // CLD works on the original prose, not on TT placeholders or URL fragments.
  const prose = text.replace(/https?:\/\/\S+|@[\w]+|\$[\w]+|⟦\s*TT\s*\d+\s*⟧/giu, " ");
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 500);
    try {
      detect(prose, (result) => {
        clearTimeout(timer);
        if (globalThis.chrome?.runtime?.lastError) {
          resolve(undefined);
          return;
        }
        const best = result?.languages?.[0];
        resolve(
          result?.isReliable && best && best.percentage >= 70 && best.language !== "und"
            ? best.language
            : undefined
        );
      });
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}
