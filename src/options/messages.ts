export type InterfaceLanguage = "auto" | "ru" | "en";
export type ResolvedInterfaceLanguage = Exclude<InterfaceLanguage, "auto">;

const translations = {
  ru: {
    extensionName: "Tweet Translator",
    settingsSubtitle: "Автоматически переводит твиты при наведении в Axiom, GMGN и Padre.",
    interfaceLanguage: "Язык интерфейса",
    interfaceLanguageHelp: "Меняет язык этой страницы и подписей в окне перевода.",
    automatic: "Как в браузере",
    russian: "Русский",
    english: "English",
    enabled: "Включить перевод твитов",
    enabledHelp: "Главный выключатель перевода на всех выбранных сайтах.",
    platforms: "Где переводить",
    targetLanguage: "Язык перевода твитов",
    targetLanguageHelp: "На этот язык будет переводиться текст твитов.",
    translationProvider: "Сервис перевода",
    googleFreeProvider: "Google Translate — бесплатно",
    proxyProvider: "Собственный сервер перевода",
    proxyUrl: "Адрес сервера перевода",
    googleNotice:
      "Google работает без ключа и бесплатно, но иногда может временно ограничивать запросы.",
    save: "Сохранить настройки",
    saved: "Настройки сохранены"
  },
  en: {
    extensionName: "Tweet Translator",
    settingsSubtitle: "Automatically translates tweets on hover in Axiom, GMGN and Padre.",
    interfaceLanguage: "Interface language",
    interfaceLanguageHelp: "Changes the language of this page and translation window labels.",
    automatic: "Same as browser",
    russian: "Русский",
    english: "English",
    enabled: "Enable tweet translation",
    enabledHelp: "Master switch for translation on all selected sites.",
    platforms: "Translate on",
    targetLanguage: "Tweet translation language",
    targetLanguageHelp: "Tweet text will be translated into this language.",
    translationProvider: "Translation service",
    googleFreeProvider: "Google Translate — free",
    proxyProvider: "Custom translation server",
    proxyUrl: "Translation server address",
    googleNotice:
      "Google works for free without an API key, but it may temporarily limit requests.",
    save: "Save settings",
    saved: "Settings saved"
  }
} as const;

export type MessageKey = keyof (typeof translations)["en"];

export function resolveInterfaceLanguage(
  selected: InterfaceLanguage,
  browserLanguage: string
): ResolvedInterfaceLanguage {
  if (selected !== "auto") return selected;
  return browserLanguage.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function optionMessage(language: ResolvedInterfaceLanguage, key: MessageKey): string {
  return translations[language][key];
}
