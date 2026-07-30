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
  it("evicts the least recently used successful result", async () => {
    const translate = vi.fn(async ({ text }: { text: string }) => ({ text }));
    const translator = new Translator(
      { id: "test", translate } as TranslationProvider,
      1_000,
      0,
      2
    );
    await translator.translate("one");
    await translator.translate("two");
    await translator.translate("one");
    await translator.translate("three");
    await translator.translate("two");
    expect(translate).toHaveBeenCalledTimes(4);
  });
  it("does not cache failed requests", async () => {
    const translate = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ text: "ok" });
    const translator = new Translator({ id: "test", translate } as TranslationProvider, 1_000, 0);
    await expect(translator.translate("hello")).rejects.toThrow("offline");
    await expect(translator.translate("hello")).resolves.toEqual({ text: "ok" });
    expect(translate).toHaveBeenCalledTimes(2);
  });
});
