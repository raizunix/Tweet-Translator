import { afterEach, describe, expect, it, vi } from "vitest";
import { Translator } from "../../src/translation/translator";
import { translateProtected } from "../../src/translation/protected-request";
import { detectSourceLanguage } from "../../src/translation/language";
import { RacingTranslationProvider } from "../../src/translation/providers/racing";
import { TranslationError } from "../../src/translation/errors";
import type { TranslationResult } from "../../src/translation/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("translation reliability", () => {
  it("reassembles protected terms locally when a service damages markers", async () => {
    const translate = vi.fn(async ({ text }: { text: string }) => ({
      text: text.includes("⟦")
        ? "Завтра команда выпустит TT0."
        : text === "The team will release"
          ? "Команда выпустит"
          : "завтра.",
      detectedLanguage: "en"
    }));
    const translator = new Translator({ translate }, 1000, 0, 200, ["Bitcoin"]);
    const result = await translator.translate("The team will release Bitcoin tomorrow.");
    expect(result.text).toBe("Команда выпустит Bitcoin завтра.");
    expect(translate.mock.calls.map(([request]) => request.text)).toEqual([
      "The team will release ⟦TT0⟧ tomorrow.",
      "The team will release",
      "tomorrow."
    ]);
  });

  it("preserves Chinese prose, amounts, URLs, emoji and paragraph breaks in the fragment fallback", async () => {
    const translate = vi.fn(async ({ text }: { text: string }) => ({
      text: text.includes("⟦")
        ? "потерянные маркеры"
        : text === "明天发布"
          ? "Завтра выпустят"
          : "Обновление",
      detectedLanguage: "zh"
    }));
    const translator = new Translator({ translate }, 1000, 0, 200, []);
    expect(
      (await translator.translate("明天发布 $SOL 100% 🚀\n\n更新 https://example.com/a")).text
    ).toBe("Завтра выпустят $SOL 100% 🚀\n\nОбновление https://example.com/a");
  });

  it("returns fully protected posts without contacting any service", async () => {
    const translate = vi.fn();
    const translator = new Translator({ translate }, 1000, 0);
    expect((await translator.translate("GM $SOL 🚀\nhttps://example.com")).text).toBe(
      "GM $SOL 🚀\nhttps://example.com"
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it("detects the original Chinese text before masking and passes its language", async () => {
    const detectLanguage = vi.fn((_text, callback) =>
      callback({ isReliable: true, languages: [{ language: "zh", percentage: 99 }] })
    );
    vi.stubGlobal("chrome", { i18n: { detectLanguage } });
    const translate = vi.fn(async () => ({ text: "Завтра выйдет обновление ⟦TT0⟧" }));
    const translator = new Translator({ translate }, 1000, 0, 200, []);
    await translator.translate("明天发布更新 $SOL");
    expect(detectLanguage.mock.calls[0][0]).toContain("明天发布更新");
    expect(detectLanguage.mock.calls[0][0]).not.toContain("⟦TT");
    expect(translate.mock.calls[0]).toEqual([
      expect.objectContaining({ sourceLanguage: "zh" }),
      expect.any(AbortSignal)
    ]);
  });

  it("does not invent a language on unreliable or missing detection", async () => {
    vi.stubGlobal("chrome", {
      i18n: {
        detectLanguage: (_text: string, callback: (result: unknown) => void) =>
          callback({ isReliable: false, languages: [{ language: "en", percentage: 90 }] })
      }
    });
    expect(await detectSourceLanguage("ambiguous")).toBeUndefined();
  });

  it("keeps an in-flight request reusable and caches its result after the caller detaches", async () => {
    let release!: (result: TranslationResult) => void;
    const translate = vi.fn(
      () =>
        new Promise<TranslationResult>((resolve) => {
          release = resolve;
        })
    );
    const translator = new Translator({ translate }, 1000, 0);
    const first = translator.translate("Hello world");
    await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(1));
    expect(translator.translate("Hello world")).toBe(first);
    release({ text: "Привет, мир" });
    await first;
    expect((await translator.translate("Hello world")).text).toBe("Привет, мир");
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "prevents stale cache writes and pending deletion (new first: %s)",
    async (newFirst) => {
      const releases: Array<(result: TranslationResult) => void> = [];
      const translate = vi.fn(
        () => new Promise<TranslationResult>((resolve) => releases.push(resolve))
      );
      const translator = new Translator({ translate }, 1000, 0);
      const oldRequest = translator.translate("Hello");
      const forced = translator.translate("Hello", "ru", true);
      await vi.waitFor(() => expect(releases).toHaveLength(2));
      if (newFirst) {
        releases[1]({ text: "Новый" });
        await forced;
        releases[0]({ text: "Старый" });
        await oldRequest;
      } else {
        releases[0]({ text: "Старый" });
        await oldRequest;
        expect(translator.translate("Hello")).toBe(forced);
        releases[1]({ text: "Новый" });
        await forced;
      }
      expect((await translator.translate("Hello")).text).toBe("Новый");
      expect(translate).toHaveBeenCalledTimes(2);
    }
  );

  it("settles a hung provider even if it ignores abort", async () => {
    vi.useFakeTimers();
    const translator = new Translator({ translate: () => new Promise(() => undefined) }, 50, 0);
    const assertion = expect(translator.translate("Hello")).rejects.toThrow(
      "Translation took too long"
    );
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });

  it("does not retry an exhausted quota or an unsupported pair", async () => {
    for (const code of ["rate-limit", "unsupported"] as const) {
      const translate = vi.fn().mockRejectedValue(new TranslationError("Unavailable", code, 60000));
      await expect(new Translator({ translate }, 1000, 2).translate("Hello")).rejects.toThrow();
      expect(translate).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a confidently detected wrong output language before it wins", async () => {
    vi.stubGlobal("chrome", {
      i18n: {
        detectLanguage: (text: string, callback: (result: unknown) => void) =>
          callback({
            isReliable: true,
            languages: [{ language: text.startsWith("Bonjour") ? "fr" : "ru", percentage: 99 }]
          })
      }
    });
    const race = new RacingTranslationProvider([
      { id: "wrong", translate: async () => ({ text: "Bonjour tout le monde" }) },
      { id: "right", translate: async () => ({ text: "Здравствуйте, дорогие друзья" }) }
    ]);
    expect(
      (
        await race.translate(
          { text: "Hello everyone", targetLanguage: "ru" },
          new AbortController().signal
        )
      ).text
    ).toBe("Здравствуйте, дорогие друзья");
  });

  it("does not continue a fragment fallback after cancellation", async () => {
    const controller = new AbortController();
    const translate = vi.fn(async () => {
      controller.abort();
      return { text: "No markers" };
    });
    await expect(
      translateProtected(
        translate,
        { text: "Hello ⟦TT0⟧", targetLanguage: "ru" },
        controller.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(translate).toHaveBeenCalledTimes(1);
  });
});
