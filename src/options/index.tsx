import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from "../shared/settings";
import { getLanguageName, TARGET_LANGUAGES } from "./languages";
import { optionMessage, resolveInterfaceLanguage, type InterfaceLanguage } from "./messages";
import "./styles.css";

const browserLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || navigator.language || "en";

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const uiLanguage = resolveInterfaceLanguage(settings.interfaceLanguage, browserLanguage);
  const message = (key: Parameters<typeof optionMessage>[1]) => optionMessage(uiLanguage, key);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);
  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.title = optionMessage(uiLanguage, "extensionName");
  }, [uiLanguage]);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((old) => ({ ...old, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const addTerm = () => {
    const term = newTerm.trim();
    if (
      term &&
      !settings.cryptoTerms.some((existing) => existing.toLowerCase() === term.toLowerCase())
    ) {
      update("cryptoTerms", [...settings.cryptoTerms, term]);
    }
    setNewTerm("");
  };
  return (
    <main>
      <h1>{message("extensionName")}</h1>
      <p>{message("settingsSubtitle")}</p>
      <form onSubmit={submit}>
        <label>
          {message("interfaceLanguage")}
          <select
            value={settings.interfaceLanguage}
            onChange={(e) => update("interfaceLanguage", e.target.value as InterfaceLanguage)}
          >
            <option value="auto">{message("automatic")}</option>
            <option value="ru">{message("russian")}</option>
            <option value="en">{message("english")}</option>
          </select>
          <small>{message("interfaceLanguageHelp")}</small>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          <span className="toggle-copy">
            <strong>{message("enabled")}</strong>
            <small>{message("enabledHelp")}</small>
          </span>
        </label>
        <fieldset className="compact-grid platforms">
          <legend>{message("platforms")}</legend>
          <label>
            <input
              type="checkbox"
              checked={settings.platforms.axiom}
              onChange={(e) =>
                update("platforms", { ...settings.platforms, axiom: e.target.checked })
              }
            />{" "}
            Axiom
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.platforms.gmgn}
              onChange={(e) =>
                update("platforms", { ...settings.platforms, gmgn: e.target.checked })
              }
            />{" "}
            GMGN
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.platforms.padre}
              onChange={(e) =>
                update("platforms", { ...settings.platforms, padre: e.target.checked })
              }
            />{" "}
            Padre
          </label>
        </fieldset>
        <label>
          {message("targetLanguage")}
          <select
            value={settings.targetLanguage}
            onChange={(e) => update("targetLanguage", e.target.value)}
          >
            {!TARGET_LANGUAGES.includes(
              settings.targetLanguage as (typeof TARGET_LANGUAGES)[number]
            ) && (
              <option value={settings.targetLanguage}>
                {getLanguageName(settings.targetLanguage, uiLanguage)}
              </option>
            )}
            {TARGET_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {getLanguageName(code, uiLanguage)}
              </option>
            ))}
          </select>
          <small>{message("targetLanguageHelp")}</small>
        </label>
        <fieldset className="service-card">
          <legend>{message("translationServices")}</legend>
          <p className="service-help">{message("parallelTranslationHelp")}</p>
          <div className="compact-grid">
            {(
              [
                ["google", "googleFreeProvider"],
                ["bing", "bingProvider"],
                ["tartu", "tartuProvider"],
                ["myMemory", "myMemoryProvider"],
                ["libreTranslate", "libreTranslateProvider"],
                ["lingva", "lingvaProvider"],
                ["apertium", "apertiumProvider"]
              ] as const
            ).map(([provider, label]) => (
              <label className="check-card" key={provider}>
                <input
                  type="checkbox"
                  checked={settings.providers[provider]}
                  onChange={(event) =>
                    update("providers", {
                      ...settings.providers,
                      [provider]: event.target.checked
                    })
                  }
                />{" "}
                {message(label)}
              </label>
            ))}
            <label className="check-card">
              <input
                type="checkbox"
                checked={settings.providers.proxy}
                onChange={(e) =>
                  update("providers", { ...settings.providers, proxy: e.target.checked })
                }
              />{" "}
              {message("proxyFallback")}
            </label>
          </div>
          <small>{message("providerPrivacy")}</small>
        </fieldset>
        {settings.providers.proxy && (
          <label>
            {message("proxyUrl")}
            <input
              type="url"
              value={settings.proxyUrl}
              placeholder="https://translate.example.com/v1/translate"
              onChange={(e) => update("proxyUrl", e.target.value)}
            />
          </label>
        )}
        <details className="dictionary">
          <summary>
            <span>
              <strong>{message("cryptoDictionarySummary")}</strong>
              <small>{message("cryptoDictionaryHelp")}</small>
            </span>
            <span className="term-count">
              {settings.cryptoTerms.filter((term) => term.trim()).length} {message("terms")}
            </span>
          </summary>
          <div className="term-list" aria-label={message("cryptoDictionary")}>
            {settings.cryptoTerms
              .filter((term) => term.trim())
              .map((term, index) => (
                <span className="term-chip" key={`${term}-${index}`}>
                  {term}
                  <button
                    type="button"
                    aria-label={`Remove ${term}`}
                    onClick={() =>
                      update(
                        "cryptoTerms",
                        settings.cryptoTerms.filter((_, termIndex) => termIndex !== index)
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          <input
            className="term-input"
            value={newTerm}
            placeholder={message("addTerm")}
            onChange={(event) => setNewTerm(event.target.value)}
            onBlur={addTerm}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTerm();
              }
            }}
          />
          <button
            className="secondary"
            type="button"
            onClick={() => update("cryptoTerms", [...DEFAULT_SETTINGS.cryptoTerms])}
          >
            {message("resetDictionary")}
          </button>
        </details>
        <div className="buttons">
          <button type="submit">{message("save")}</button>
          <span>{saved ? message("saved") : ""}</span>
        </div>
      </form>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
