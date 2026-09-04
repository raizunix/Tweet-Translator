import type { Settings } from "../shared/settings";
import type { TranslationProvider } from "./types";
import { GoogleFreeTranslationProvider } from "./providers/google-free";
import { MyMemoryTranslationProvider } from "./providers/mymemory";
import { ProxyTranslationProvider } from "./providers/proxy";
import { RacingTranslationProvider } from "./providers/racing";
import { RuntimeTranslationProvider } from "./providers/runtime";

export function createTranslationProvider(settings: Settings): TranslationProvider {
  const providers: TranslationProvider[] = [];
  if (settings.providers.google) providers.push(new GoogleFreeTranslationProvider());
  if (settings.providers.bing) providers.push(new RuntimeTranslationProvider("bing"));
  if (settings.providers.tartu) providers.push(new RuntimeTranslationProvider("tartu"));
  if (settings.providers.myMemory) providers.push(new MyMemoryTranslationProvider());
  if (settings.providers.libreTranslate)
    providers.push(new RuntimeTranslationProvider("libretranslate"));
  if (settings.providers.lingva) providers.push(new RuntimeTranslationProvider("lingva"));
  if (settings.providers.apertium) providers.push(new RuntimeTranslationProvider("apertium"));
  if (settings.providers.proxy && settings.proxyUrl)
    providers.push(new ProxyTranslationProvider(settings.proxyUrl));
  if (!providers.length) throw new Error("Enable at least one translation provider");
  return new RacingTranslationProvider(providers);
}
