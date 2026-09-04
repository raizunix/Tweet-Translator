# Tweet Translator: fast project map

Read this file first. Open only the files relevant to the task.

## Runtime flow

`src/content/index.ts` detects a supported popup, creates `TranslationOverlay`, and calls
`Translator` for each text block.

`src/translation/translator.ts` owns normalization, protected-term restoration, timeout,
deduplication, retry bypass, and LRU cache.

`src/translation/provider-factory.ts` builds enabled providers from `Settings`.
`src/translation/providers/racing.ts` runs a hedged race, rejects unchanged source text, aborts
losers after the first usable result, and performs a recovery probe when every circuit is open.

Cloud calls go through the MV3 service worker in `src/background/index.ts` so host permissions
and real fetch cancellation work. Public mirror lists and response parsing live in
`src/background/free-providers.ts`.

`src/ui/overlay.ts` clones the source popup and owns loading/success/error/copy/reload UI.

## Settings

The schema, defaults, and legacy migration are in `src/shared/settings.ts`. The content script
has a small duplicated default object in `src/content/index.ts` to prevent Vite from emitting an
ES module import that Chrome content scripts cannot load. Keep both defaults synchronized.

The React options UI is `src/options/index.tsx`; text is in `src/options/messages.ts`.

## Providers

- Google: `providers/google-free.ts` → background Google handler.
- Bing and TartuNLP: generic `providers/runtime.ts` → `free-providers.ts`.
- MyMemory: `providers/mymemory.ts` → background MyMemory handler.
- LibreTranslate, Lingva, Apertium: generic `providers/runtime.ts` → `free-providers.ts`.
- Custom user server: `providers/proxy.ts`.

All public providers are optional and enabled by default. Public mirrors are unreliable; failure
must never block another provider from winning the race.

Reliability rationale and external comparisons are in `docs/RELIABILITY_AUDIT.md`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Unit tests are under
`tests/unit`; browser coverage is in `tests/e2e/extension.spec.ts`.
