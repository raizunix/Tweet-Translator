import { describe, expect, it } from "vitest";
import { optionMessage, resolveInterfaceLanguage } from "../../src/options/messages";

describe("options localization", () => {
  it("uses Russian only for a Russian browser in automatic mode", () => {
    expect(resolveInterfaceLanguage("auto", "ru-RU")).toBe("ru");
    expect(resolveInterfaceLanguage("auto", "en-US")).toBe("en");
    expect(resolveInterfaceLanguage("auto", "de-DE")).toBe("en");
  });

  it("allows an explicit interface language", () => {
    expect(resolveInterfaceLanguage("en", "ru-RU")).toBe("en");
    expect(resolveInterfaceLanguage("ru", "en-US")).toBe("ru");
    expect(optionMessage("ru", "targetLanguage")).toBe("Язык перевода твитов");
  });
});
