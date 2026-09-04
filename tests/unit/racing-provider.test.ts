import { describe, expect, it, vi } from "vitest";
import { RacingTranslationProvider } from "../../src/translation/providers/racing";
import type { TranslationProvider } from "../../src/translation/types";

const provider = (
  id: string,
  translate: TranslationProvider["translate"]
): TranslationProvider => ({ id, translate });

describe("racing translation provider", () => {
  it("starts all providers together and aborts the slower one", async () => {
    let releaseSlow: ((value: { text: string }) => void) | undefined;
    let slowSignal: AbortSignal | undefined;
    const slow = provider("slow", (_request, signal) => {
      slowSignal = signal;
      return new Promise((resolve) => {
        releaseSlow = resolve;
      });
    });
    const fast = provider("fast", async () => ({ text: "привет" }));
    const race = new RacingTranslationProvider([slow, fast]);

    await expect(
      race.translate({ text: "hello", targetLanguage: "ru" }, new AbortController().signal)
    ).resolves.toEqual({ text: "привет" });
    expect(slowSignal?.aborted).toBe(true);
    releaseSlow?.({ text: "медленно" });
  });

  it("ignores an unchanged source response and waits for a real translation", async () => {
    const unchanged = provider("unchanged", async () => ({ text: "Hello" }));
    const translated = provider("translated", async () => ({ text: "Привет" }));
    const race = new RacingTranslationProvider([unchanged, translated]);

    await expect(
      race.translate({ text: "Hello", targetLanguage: "ru" }, new AbortController().signal)
    ).resolves.toEqual({ text: "Привет" });
  });

  it("rejects a provider that loses a protected marker", async () => {
    const corrupted = provider("corrupted", async () => ({ text: "Перевод" }));
    const intact = provider("intact", async () => ({ text: "Перевод ⟦TT0⟧" }));
    const race = new RacingTranslationProvider([corrupted, intact]);

    await expect(
      race.translate({ text: "Hello ⟦TT0⟧", targetLanguage: "ru" }, new AbortController().signal)
    ).resolves.toEqual({ text: "Перевод ⟦TT0⟧" });
  });

  it("accepts unchanged text when it is already in the target language", async () => {
    const alreadyTranslated = provider("same-language", async () => ({
      text: "Привет",
      detectedLanguage: "ru"
    }));
    const race = new RacingTranslationProvider([alreadyTranslated]);

    await expect(
      race.translate({ text: "Привет", targetLanguage: "ru" }, new AbortController().signal)
    ).resolves.toEqual({ text: "Привет", detectedLanguage: "ru" });
  });

  it("propagates cancellation to every provider", async () => {
    const aborted = vi.fn();
    const waiting = provider(
      "waiting",
      (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted();
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );
    const controller = new AbortController();
    const translation = new RacingTranslationProvider([waiting, waiting]).translate(
      { text: "hello", targetLanguage: "ru" },
      controller.signal
    );
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(translation).rejects.toMatchObject({ name: "AbortError" });
    expect(aborted).toHaveBeenCalledTimes(2);
  });

  it("counts a provider timeout as a circuit-breaker failure", async () => {
    const translate = vi.fn();
    translate.mockImplementation(
      (_request: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
    );
    const hanging = provider("hanging", translate as TranslationProvider["translate"]);
    const race = new RacingTranslationProvider([hanging], {
      providerTimeoutMs: 5,
      failureThreshold: 1,
      resetAfterMs: 10_000
    });

    await expect(
      race.translate({ text: "Hello", targetLanguage: "ru" }, new AbortController().signal)
    ).rejects.toThrow("hanging timed out");
    await expect(
      race.translate({ text: "Hello", targetLanguage: "ru" }, new AbortController().signal)
    ).rejects.toThrow("hanging timed out");
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("does not start a hedged fallback when the primary wins quickly", async () => {
    const fallback = vi.fn(async () => ({ text: "запасной" }));
    const race = new RacingTranslationProvider([
      provider("google-free", async () => ({ text: "основной" })),
      provider("bing", fallback)
    ]);

    await expect(
      race.translate({ text: "Hello", targetLanguage: "ru" }, new AbortController().signal)
    ).resolves.toEqual({ text: "основной" });
    expect(fallback).not.toHaveBeenCalled();
  });
});
