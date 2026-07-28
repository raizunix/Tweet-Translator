import { describe, expect, it, vi } from "vitest";
import { normalizeText, Translator } from "../../src/translation/translator";
import type { TranslationProvider } from "../../src/translation/types";

describe("Translator", () => {
  it("normalizes spacing while preserving paragraphs", () =>
    expect(normalizeText("  hello  \n\n\n world ")).toBe("hello\n\nworld"));
  it("deduplicates concurrent requests and caches results", async () => {
    const translate = vi.fn(async () => ({ text: "привет", detectedLanguage: "en" }));
    const translator = new Translator({ translate } as TranslationProvider);
    const [first, second] = await Promise.all([
      translator.translate("hello"),
      translator.translate(" hello ")
    ]);
    expect(first).toEqual(second);
    expect(translate).toHaveBeenCalledTimes(1);
    await translator.translate("hello");
    expect(translate).toHaveBeenCalledTimes(1);
  });
  it("retries failures", async () => {
    const translate = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ text: "готово" });
    const translator = new Translator({ translate } as TranslationProvider, 1_000, 1);
    await expect(translator.translate("done")).resolves.toEqual({ text: "готово" });
    expect(translate).toHaveBeenCalledTimes(2);
  });
});
