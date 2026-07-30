import { describe, expect, it, vi } from "vitest";
import { SequentialTranslationProvider } from "../../src/translation/providers/sequential";
import type { TranslationProvider } from "../../src/translation/types";

const provider = (
  id: string,
  translate: TranslationProvider["translate"]
): TranslationProvider => ({
  id,
  translate
});

describe("sequential provider chain", () => {
  it("calls fallbacks strictly after a failure", async () => {
    const order: string[] = [];
    const first = provider("first", async () => {
      order.push("first");
      throw new Error("offline");
    });
    const second = provider("second", async () => {
      order.push("second");
      return { text: "ok" };
    });
    await expect(
      new SequentialTranslationProvider([first, second]).translate(
        { text: "hello", targetLanguage: "ru" },
        new AbortController().signal
      )
    ).resolves.toEqual({ text: "ok" });
    expect(order).toEqual(["first", "second"]);
  });

  it("does not fall back after AbortError", async () => {
    const fallback = vi.fn(async () => ({ text: "wrong" }));
    const chain = new SequentialTranslationProvider([
      provider("first", async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
      provider("fallback", fallback)
    ]);
    await expect(
      chain.translate({ text: "hello", targetLanguage: "ru" }, new AbortController().signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("opens and later resets a provider circuit", async () => {
    let now = 0;
    const failed = vi.fn(async () => {
      throw new Error("offline");
    });
    const fallback = vi.fn(async () => ({ text: "ok" }));
    const chain = new SequentialTranslationProvider(
      [provider("first", failed), provider("fallback", fallback)],
      { failureThreshold: 2, resetAfterMs: 100, now: () => now }
    );
    const request = { text: "hello", targetLanguage: "ru" };
    await chain.translate(request, new AbortController().signal);
    await chain.translate(request, new AbortController().signal);
    await chain.translate(request, new AbortController().signal);
    expect(failed).toHaveBeenCalledTimes(2);
    now = 101;
    await chain.translate(request, new AbortController().signal);
    expect(failed).toHaveBeenCalledTimes(3);
  });
});
