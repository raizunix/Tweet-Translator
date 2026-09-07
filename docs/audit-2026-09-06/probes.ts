// Diagnostic reproduction of the audited implementation, not regression requirements.
// Run: node node_modules/vite-node/vite-node.mjs docs/audit-2026-09-06/probes.ts
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Translator } from "../../src/translation/translator";
import { RacingTranslationProvider } from "../../src/translation/providers/racing";
import { translateWithFreeProvider } from "../../src/background/free-providers";
import type { TranslationResult } from "../../src/translation/types";

const originalFetch = globalThis.fetch;
const findings: Record<string, unknown> = {};
try {
  let requestBody = "";
  globalThis.fetch = (async (_url, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({ result: "Некоторый ответ" }));
  }) as typeof fetch;
  const languageResult = await translateWithFreeProvider(
    "tartu", { text: "今日は良い天気です", targetLanguage: "ru" }, new AbortController().signal
  );
  assert.equal(JSON.parse(requestBody).src, "eng");
  assert.equal(languageResult.detectedLanguage, "en");
  findings.assumedSourceLanguage = { sentSource: "eng", claimedDetection: "en" };

  let fetchSignal: AbortSignal | undefined;
  let releaseBody!: (value: { result: string }) => void;
  let bodyStarted!: () => void;
  const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
  globalThis.fetch = (async (_url, init) => {
    fetchSignal = init?.signal ?? undefined;
    return {
      ok: true, status: 200,
      json: () => {
        bodyStarted();
        return new Promise((resolve) => { releaseBody = resolve; });
      }
    };
  }) as typeof fetch;
  const parent = new AbortController();
  const bodyRequest = translateWithFreeProvider(
    "tartu", { text: "Hello", targetLanguage: "ru" }, parent.signal
  );
  await started;
  parent.abort();
  assert.equal(fetchSignal?.aborted, false);
  releaseBody({ result: "Привет" });
  await bodyRequest;
  findings.bodyCancellation = { parentAborted: true, fetchSignalAborted: false, acceptedAfterAbort: true };

  const mirrorCalls: string[] = [];
  globalThis.fetch = (async (url) => {
    mirrorCalls.push(String(url));
    return new Response(JSON.stringify({ translatedText: mirrorCalls.length === 1 ? "Hello" : "Привет" }));
  }) as typeof fetch;
  const mirrorRace = new RacingTranslationProvider([{
    id: "audit-mirrors",
    translate: (request, signal) => translateWithFreeProvider("libretranslate", request, signal)
  }]);
  await assert.rejects(mirrorRace.translate({ text: "Hello", targetLanguage: "ru" }, new AbortController().signal));
  assert.equal(mirrorCalls.length, 1);
  findings.invalidMirrorWins = { failed: true, mirrorsCalled: mirrorCalls.length, validSecondMirrorSkipped: true };

  const echo = new RacingTranslationProvider([{
    id: "echo", translate: async ({ text }) => ({ text, detectedLanguage: "en" })
  }]);
  const protectedOnly = new Translator(echo, 100, 0);
  await assert.rejects(protectedOnly.translate("GM $SOL 🚀"));
  findings.protectedOnly = { input: "GM $SOL 🚀", result: "rejected although nothing needs translation" };

  const releases: Array<(value: TranslationResult) => void> = [];
  const forceTranslator = new Translator({
    id: "deferred", translate: () => new Promise((resolve) => { releases.push(resolve); })
  }, 1000, 0);
  const oldRequest = forceTranslator.translate("Hello");
  const newRequest = forceTranslator.translate("Hello", "ru", true);
  releases[1]({ text: "Новый перевод" });
  await newRequest;
  releases[0]({ text: "Старый перевод" });
  await oldRequest;
  const cached = await forceTranslator.translate("Hello");
  assert.equal(cached.text, "Старый перевод");
  findings.forceCache = { cachedText: cached.text, staleRequestOverwroteForcedResult: true };

  const wrongLanguage = new RacingTranslationProvider([{
    id: "wrong-language", translate: async () => ({ text: "Bonjour tout le monde" })
  }]);
  findings.outputLanguage = await wrongLanguage.translate(
    { text: "Hello world", targetLanguage: "ru" }, new AbortController().signal
  );
  assert.equal((findings.outputLanguage as TranslationResult).text, "Bonjour tout le monde");
} finally {
  globalThis.fetch = originalFetch;
}
const report = { observedAt: new Date().toISOString(), findings };
writeFileSync(new URL("./reproductions.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
