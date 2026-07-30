import type { Settings } from "../shared/settings";
import type { TranslationProvider } from "./types";
import { GoogleFreeTranslationProvider } from "./providers/google-free";
import { MyMemoryTranslationProvider } from "./providers/mymemory";
import { ProxyTranslationProvider } from "./providers/proxy";
import { SequentialTranslationProvider } from "./providers/sequential";

export function createTranslationProvider(settings: Settings): TranslationProvider {
  const providers: TranslationProvider[] = [new GoogleFreeTranslationProvider()];
  if (settings.fallbacks.myMemory) providers.push(new MyMemoryTranslationProvider());
  if (settings.fallbacks.proxy && settings.proxyUrl)
    providers.push(new ProxyTranslationProvider(settings.proxyUrl));
  return new SequentialTranslationProvider(providers);
}
