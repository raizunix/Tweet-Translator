export interface Settings {
  enabled: boolean;
  platforms: { axiom: boolean; gmgn: boolean; padre: boolean };
  interfaceLanguage: "auto" | "ru" | "en";
  targetLanguage: string;
  provider: "google-free" | "proxy";
  proxyUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { axiom: true, gmgn: true, padre: true },
  interfaceLanguage: "auto",
  targetLanguage: "ru",
  provider: "google-free",
  proxyUrl: import.meta.env.VITE_TRANSLATION_PROXY_URL ?? ""
};

export async function getSettings(): Promise<Settings> {
  if (typeof chrome === "undefined" || !chrome.storage) return DEFAULT_SETTINGS;
  const stored = await chrome.storage.sync.get("settings");
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(stored.settings ?? {}),
    platforms: { ...DEFAULT_SETTINGS.platforms, ...(stored.settings?.platforms ?? {}) }
  };
  if (settings.provider === "proxy" && !settings.proxyUrl) settings.provider = "google-free";
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}
