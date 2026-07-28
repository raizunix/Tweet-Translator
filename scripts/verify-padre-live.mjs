/* global document, window, getComputedStyle, Event, requestAnimationFrame */
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { stdout } from "node:process";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().includes("trade.padre.gg"));

if (!page) throw new Error("Open trade.padre.gg in the CDP browser first");
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator('a[href*="/status/"]').first().waitFor({ state: "visible", timeout: 15_000 });

await page.evaluate(() => {
  const chromeApi = window.chrome;
  Object.defineProperties(chromeApi, {
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
              proxyUrl: ""
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
        id: "live-padre-audit",
        lastError: undefined,
        sendMessage: (payload, callback) =>
          callback({
            ok: true,
            text: `ПЕРЕВОД: ${payload.request.text}`,
            detectedLanguage: "en"
          })
      }
    }
  });
});
const contentSource = await readFile(resolve("extension/content.js"), "utf8");
const cdp = await page.context().newCDPSession(page);
await cdp.send("Runtime.evaluate", { expression: contentSource });

const anchor = page.locator('a[href*="/status/"]').first();
await page.mouse.move(800, 700);
await page.waitForTimeout(500);
await anchor.hover();
await page.waitForTimeout(1_500);

const first = await page.evaluate(() => {
  const original = document.querySelector('[role="tooltip"]');
  const overlay = document.querySelector('[data-tweet-translator="overlay"]');
  return {
    originalVisible: Boolean(original),
    overlayVisible: Boolean(overlay),
    translatedBlocks: overlay?.textContent?.match(/ПЕРЕВОД:/g)?.length ?? 0,
    hasImage: Boolean(overlay?.querySelector("img")),
    hasVideo: Boolean(overlay?.querySelector("video"))
  };
});

const originalLink = page.locator('[role="tooltip"] a').first();
await originalLink.hover();
await page.waitForTimeout(300);
const staysOpenOnLink = await page.locator('[data-tweet-translator="overlay"]').count();

const scroll = await page.evaluate(async () => {
  const findScroller = (root) =>
    [root, ...root.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight
        );
      })
      .sort(
        (left, right) =>
          right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight)
      )[0];
  const original = document.querySelector('[role="tooltip"]');
  const overlay = document.querySelector('[data-tweet-translator="overlay"]');
  const source = original && findScroller(original);
  const clone = overlay && findScroller(overlay);
  if (!source || !clone) return null;
  source.scrollTop = source.scrollHeight - source.clientHeight;
  source.dispatchEvent(new Event("scroll"));
  await new Promise((resolvePromise) => requestAnimationFrame(resolvePromise));
  return {
    sourceProgress: source.scrollTop / (source.scrollHeight - source.clientHeight),
    cloneProgress: clone.scrollTop / (clone.scrollHeight - clone.clientHeight)
  };
});

await page.mouse.move(800, 700);
await page.waitForTimeout(600);
await anchor.hover();
await page.waitForTimeout(1_200);
const repeated = await page.locator('[data-tweet-translator="overlay"]').count();

if (
  !first.originalVisible ||
  !first.overlayVisible ||
  first.translatedBlocks < 2 ||
  staysOpenOnLink !== 1 ||
  !scroll ||
  scroll.sourceProgress < 0.99 ||
  scroll.cloneProgress < 0.99 ||
  repeated !== 1
) {
  throw new Error(
    `Padre live verification failed: ${JSON.stringify({
      first,
      staysOpenOnLink,
      scroll,
      repeated
    })}`
  );
}

stdout.write(`${JSON.stringify({ first, staysOpenOnLink, scroll, repeated })}\n`);
await browser.close();
