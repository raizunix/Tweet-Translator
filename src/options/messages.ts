export type InterfaceLanguage = "auto" | "ru" | "en";
export type ResolvedInterfaceLanguage = Exclude<InterfaceLanguage, "auto">;

const translations = {
  ru: {
    extensionName: "Tweet Translator",
    settingsSubtitle: "Автоматически переводит твиты при наведении в Axiom, GMGN и Padre.",
    interfaceLanguage: "Язык интерфейса",
    interfaceLanguageHelp: "Меняет язык страницы настроек и окна перевода.",
    automatic: "Как в браузере",
    russian: "Русский",
    english: "English",
    enabled: "Включить перевод твитов",
    enabledHelp: "Главный выключатель перевода на выбранных сайтах.",
    platforms: "Где переводить",
    targetLanguage: "Язык перевода твитов",
    targetLanguageHelp: "На этот язык переводится текст твитов.",
    googleFreeProvider: "Google Translate — бесплатно",
    myMemoryProvider: "MyMemory",
    libreTranslateProvider: "LibreTranslate / Argos",
    lingvaProvider: "Lingva Translate",
    apertiumProvider: "Apertium",
    translationServices: "Сервисы перевода",
    parallelTranslationHelp:
      "Запрос отправляется всем отмеченным сервисам одновременно. Используется первый пригодный ответ, остальные запросы отменяются.",
    proxyFallback: "Использовать собственный сервер",
    proxyUrl: "Адрес сервера перевода",
    providerPrivacy:
      "Текст видимого твита передаётся каждому включённому сервису. Бесплатные публичные сервисы включены по умолчанию.",
    cryptoDictionary: "Словарь защищённых криптотерминов",
    cryptoDictionarySummary: "Криптословарь",
    terms: "терминов",
    cryptoDictionaryHelp:
      "По одному термину в строке. Они сохраняются без перевода вместе со ссылками, тикерами, адресами, числами и emoji.",
    resetDictionary: "Восстановить стандартный словарь",
    addTerm: "Добавить термин и нажать Enter",
    save: "Сохранить настройки",
    saved: "Настройки сохранены"
  },
  en: {
    extensionName: "Tweet Translator",
    settingsSubtitle: "Automatically translates tweets on hover in Axiom, GMGN and Padre.",
    interfaceLanguage: "Interface language",
    interfaceLanguageHelp: "Changes the language of settings and translation window labels.",
    automatic: "Same as browser",
    russian: "Русский",
    english: "English",
    enabled: "Enable tweet translation",
    enabledHelp: "Master switch for translation on selected sites.",
    platforms: "Translate on",
    targetLanguage: "Tweet translation language",
    targetLanguageHelp: "Tweet text will be translated into this language.",
    googleFreeProvider: "Google Translate — free",
    myMemoryProvider: "MyMemory",
    libreTranslateProvider: "LibreTranslate / Argos",
    lingvaProvider: "Lingva Translate",
    apertiumProvider: "Apertium",
    translationServices: "Translation services",
    parallelTranslationHelp:
      "Requests are sent to all selected services at once. The first usable result wins and the remaining requests are cancelled.",
    proxyFallback: "Use a custom server",
    proxyUrl: "Translation server address",
    providerPrivacy:
      "Visible tweet text is sent to every enabled service. Free public services are enabled by default.",
    cryptoDictionary: "Protected crypto-term dictionary",
    cryptoDictionarySummary: "Crypto dictionary",
    terms: "terms",
    cryptoDictionaryHelp:
      "One term per line. These stay untranslated together with links, tickers, addresses, numbers and emoji.",
    resetDictionary: "Restore default dictionary",
    addTerm: "Add a term and press Enter",
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
