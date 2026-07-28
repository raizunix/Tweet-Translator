import { describe, expect, it } from "vitest";
import { getLanguageName, TARGET_LANGUAGES } from "../../src/options/languages";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";

describe("translation languages", () => {
  it("defaults to Russian and offers common target languages", () => {
    expect(DEFAULT_SETTINGS.targetLanguage).toBe("ru");
    expect(TARGET_LANGUAGES).toContain("ru");
    expect(TARGET_LANGUAGES).toContain("en");
    expect(TARGET_LANGUAGES).toContain("es");
    expect(TARGET_LANGUAGES).toContain("zh-CN");
    expect(new Set(TARGET_LANGUAGES).size).toBe(TARGET_LANGUAGES.length);
  });

  it("uses the browser locale for language names", () => {
    expect(getLanguageName("ru", "en")).toMatch(/Russian/i);
    expect(getLanguageName("en", "ru")).toMatch(/английский/i);
  });
});
