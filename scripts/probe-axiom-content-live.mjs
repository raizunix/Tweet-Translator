/* global console, document, getComputedStyle, innerHeight, window */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().includes("axiom.trade/pulse"));
if (!page) throw new Error("Open Axiom Pulse first");

await page.reload({ waitUntil: "domcontentloaded" });
await page.locator('a[href*="/status/"]:visible').first().waitFor({ timeout: 15_000 });
await page.evaluate(() => {
  Object.defineProperties(window.chrome, {
    storage: {
      configurable: true,
      value: {
        sync: {
          get: async () => ({
            settings: {
              enabled: true,
              platforms: { axiom: true, gmgn: true, padre: true },
              interfaceLanguage: "ru",
              targetLanguage: "ru",
              provider: "google-free",
              fallbacks: { myMemory: false, proxy: false },
              proxyUrl: "",
              cryptoTerms: [],
              cryptoDictionaryVersion: 2
            }
          })
        }
      }
    },
    i18n: {
      configurable: true,
      value: { getUILanguage: () => "ru", getMessage: () => "" }
    },
    runtime: {
      configurable: true,
      value: {
        id: "axiom-live-probe",
        lastError: undefined,
        sendMessage: (payload, callback) =>
          callback({ ok: true, text: `ПЕРЕВОД: ${payload.request.text}` })
      }
    }
  });
});
const source = await readFile(resolve("extension/content.js"), "utf8");
const cdp = await page.context().newCDPSession(page);
await cdp.send("Runtime.evaluate", { expression: source });

const results = [];
for (let attempt = 0; attempt < 12; attempt++) {
  const target = await page.evaluate((index) => {
    const anchors = [...document.querySelectorAll('a[href*="/status/"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.bottom < innerHeight;
    });
    const anchor = anchors[index % Math.max(anchors.length, 1)];
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, attempt);
  if (!target) continue;
  await page.mouse.move(4, 40);
  await page.waitForTimeout(180);
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => {
    const root = [...document.body.children].find((element) => {
      const text = element.textContent ?? "";
      return text.includes("followers") && text.includes("Joined") && text.includes("@");
    });
    const rect = root?.getBoundingClientRect();
    const candidates =
      root && rect
        ? [...root.querySelectorAll("span,p,article")]
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return (
                box.width >= rect.width * 0.65 &&
                box.top >= rect.top + Math.min(80, rect.height * 0.2) &&
                Number.parseFloat(getComputedStyle(element).fontSize) >= 15
              );
            })
            .map((element) => ({
              tag: element.tagName,
              text: element.textContent?.trim().slice(0, 100),
              rect: element.getBoundingClientRect().toJSON(),
              fontSize: getComputedStyle(element).fontSize
            }))
        : [];
    return {
      overlay: Boolean(document.querySelector('[data-tweet-translator="overlay"]')),
      profile: Boolean(root),
      rootRect: rect?.toJSON(),
      candidates
    };
  });
  results.push({ attempt, ...state });
}
console.log(results);
await browser.close();
