// Sends only the synthetic sample below. Not a benchmark or uptime measurement.
// Run: node node_modules/vite-node/vite-node.mjs docs/audit-2026-09-06/live-probe.ts
import { writeFileSync } from "node:fs";
import { translateWithFreeProvider, type FreeProviderId } from "../../src/background/free-providers";
import { hasIntactProtectedMarkers } from "../../src/translation/result-validation";

const fetchOriginal = globalThis.fetch;
const responses: Array<{ origin: string; status?: number; error?: string }> = [];
globalThis.fetch = (async (input, init) => {
  const origin = new URL(String(input)).origin;
  try {
    const response = await fetchOriginal(input, init);
    responses.push({ origin, status: response.status });
    return response;
  } catch (error) {
    responses.push({ origin, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}) as typeof fetch;

const results: unknown[] = [];
try {
  for (const text of ["The team will release the update tomorrow.", "The team will release ⟦TT0⟧ tomorrow."]) {
    for (const id of ["google", "bing", "tartu", "mymemory", "libretranslate", "lingva", "apertium"]) {
      const started = performance.now();
      const signal = AbortSignal.timeout(9000);
      try {
        let output: string;
        if (id === "google") {
          const url = new URL("https://translate.googleapis.com/translate_a/single");
          url.search = new URLSearchParams({ client: "gtx", sl: "auto", tl: "ru", dt: "t", q: text }).toString();
          const response = await fetch(url, { signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          output = data[0].map((part: string[]) => part[0]).join("");
        } else if (id === "mymemory") {
          const url = new URL("https://api.mymemory.translated.net/get");
          url.search = new URLSearchParams({ q: text, langpair: "en|ru" }).toString();
          const response = await fetch(url, { signal });
          const data = await response.json();
          if (!response.ok || String(data.responseStatus) !== "200") throw new Error(data.responseDetails || `HTTP ${response.status}`);
          output = data.responseData.translatedText;
        } else {
          const result = await Promise.race([
            translateWithFreeProvider(id as FreeProviderId, { text, targetLanguage: "ru" }, signal),
            new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Probe deadline")), { once: true }))
          ]);
          output = result.text;
        }
        const result = { id, input: text, ms: Math.round(performance.now() - started), output, markersIntact: hasIntactProtectedMarkers(text, output) };
        results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        const result = { id, input: text, ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) };
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }
  }
} finally {
  globalThis.fetch = fetchOriginal;
}
writeFileSync(new URL("./live-results.json", import.meta.url), JSON.stringify({ observedAt: new Date().toISOString(), results, responses }, null, 2) + "\n");
