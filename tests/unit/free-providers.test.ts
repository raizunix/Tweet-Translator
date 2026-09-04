import { afterEach, describe, expect, it, vi } from "vitest";
import { translateWithFreeProvider } from "../../src/background/free-providers";

describe("background free providers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses a TartuNLP translation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "Привет, мир." })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      translateWithFreeProvider(
        "tartu",
        { text: "Hello world", targetLanguage: "ru" },
        new AbortController().signal
      )
    ).resolves.toEqual({ text: "Привет, мир.", detectedLanguage: "en" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tartunlp.ai/translation/v2",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("loads and reuses Bing web authentication parameters", async () => {
    const html =
      'IG:"test-ig" data-iid="translator.123" params_AbusePreventionHelper = [123,"token",3600000]';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            detectedLanguage: { language: "en" },
            translations: [{ text: "Привет" }]
          }
        ]
      });
    vi.stubGlobal("fetch", fetchMock);
    const request = { text: "Hello", targetLanguage: "ru" };

    await expect(
      translateWithFreeProvider("bing", request, new AbortController().signal)
    ).resolves.toEqual({ text: "Привет", detectedLanguage: "en" });
    await expect(
      translateWithFreeProvider("bing", request, new AbortController().signal)
    ).resolves.toEqual({ text: "Привет", detectedLanguage: "en" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
