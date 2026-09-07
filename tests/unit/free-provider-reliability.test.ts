import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const signal = () => new AbortController().signal;

describe("provider capabilities and mirrors", () => {
  it.each(["tartu", "apertium"] as const)(
    "skips %s without a known source language",
    async (provider) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const { translateWithFreeProvider } = await import("../../src/background/free-providers");
      await expect(
        translateWithFreeProvider(provider, { text: "你好世界", targetLanguage: "ru" }, signal())
      ).rejects.toMatchObject({ code: "unsupported" });
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("does not send Chinese to an English Tartu model", async () => {
    const fetch = vi.fn(async () =>
      response({ domains: [{ code: "general", languages: ["eng-rus"] }] })
    );
    vi.stubGlobal("fetch", fetch);
    const { translateWithFreeProvider } = await import("../../src/background/free-providers");
    await expect(
      translateWithFreeProvider(
        "tartu",
        { text: "你好世界", targetLanguage: "ru", sourceLanguage: "zh" },
        signal()
      )
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ method: "POST" })
    );
  });

  it("checks Apertium pairs before trying an unsupported translation", async () => {
    const fetch = vi.fn(async () =>
      response({ responseData: [{ sourceLanguage: "eng", targetLanguage: "spa" }] })
    );
    vi.stubGlobal("fetch", fetch);
    const { translateWithFreeProvider } = await import("../../src/background/free-providers");
    await expect(
      translateWithFreeProvider(
        "apertium",
        { text: "Hello", targetLanguage: "ru", sourceLanguage: "en" },
        signal()
      )
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["libretranslate", "lingva"] as const)(
    "keeps racing %s mirrors after an unchanged response",
    async (provider) => {
      const fetch = vi.fn(async (url: string) => {
        if (url.endsWith("/languages"))
          return response([{ code: "en", targets: ["ru"] }, { code: "ru" }]);
        const first = url.includes("libretranslate.de") || url.includes("lingva.ml");
        return response(
          provider === "lingva"
            ? { translation: first ? "Hello" : "Привет" }
            : { translatedText: first ? "Hello" : "Привет" }
        );
      });
      vi.stubGlobal("fetch", fetch);
      const { translateWithFreeProvider } = await import("../../src/background/free-providers");
      const result = translateWithFreeProvider(
        provider,
        { text: "Hello", targetLanguage: "ru" },
        signal()
      );
      const assertion = expect(result).resolves.toMatchObject({ text: "Привет" });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(new Set(fetch.mock.calls.map(([url]) => new URL(url).origin)).size).toBeGreaterThan(1);
    }
  );

  it("blocks additional HTTP requests during Retry-After", async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 429, headers: { get: () => "15" } }));
    vi.stubGlobal("fetch", fetch);
    const { fetchJson } = await import("../../src/background/http");
    await expect(fetchJson("https://quota.example/", { signal: signal() })).rejects.toMatchObject({
      code: "rate-limit",
      retryAfterMs: 15000
    });
    await expect(fetchJson("https://quota.example/", { signal: signal() })).rejects.toMatchObject({
      code: "rate-limit"
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
