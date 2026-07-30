/* global console, document, getComputedStyle, innerHeight */
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().includes("axiom.trade/pulse"));

if (!page) throw new Error("Open the Axiom Pulse page first");

const count = 6;
const results = [];

for (let index = 0; index < count; index++) {
  const target = await page.evaluate((preferredIndex) => {
    const anchors = [...document.querySelectorAll('a[href*="/status/"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    });
    const anchor = anchors[preferredIndex % Math.max(anchors.length, 1)];
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    const row = anchor.closest("[data-pulse-token-address]");
    const other = [...(row?.querySelectorAll("i") ?? [])].find(
      (icon) => !anchor.contains(icon) && icon.getBoundingClientRect().width > 0
    );
    const otherRect = other?.getBoundingClientRect();
    return {
      href: anchor.getAttribute("href"),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      otherX: otherRect ? otherRect.left + otherRect.width / 2 : null,
      otherY: otherRect ? otherRect.top + otherRect.height / 2 : null
    };
  }, index);
  if (!target) continue;
  await page.mouse.move(4, 40);
  await page.waitForTimeout(250);
  if (index % 2 === 1 && target.otherX !== null && target.otherY !== null) {
    await page.mouse.move(target.otherX, target.otherY);
    await page.waitForTimeout(250);
  }
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(350);
  results.push({
    index,
    href: target.href,
    overlay: await page.locator('[data-tweet-translator="overlay"]').count(),
    popup: await page.locator('[role="tooltip"],[role="dialog"]').count(),
    hit: await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element
        ? {
            tag: element.tagName,
            classes: element.className,
            html: element.outerHTML.slice(0, 500)
          }
        : null;
    }, target),
    profileCards: await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((element) => {
          const text = element.textContent ?? "";
          if (!text.includes("followers") || !text.includes("@")) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width >= 200 &&
            rect.height >= 100 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        })
        .filter(
          (element, _index, all) =>
            !all.some((other) => other !== element && element.contains(other))
        )
        .map((element) => ({
          tag: element.tagName,
          classes: element.className,
          text: element.textContent?.trim().slice(0, 300),
          html: element.outerHTML.slice(0, 300),
          ancestry: (() => {
            const result = [];
            let current = element;
            while (current && current !== document.body) {
              const rect = current.getBoundingClientRect();
              const style = getComputedStyle(current);
              result.push({
                tag: current.tagName,
                classes: current.className,
                role: current.getAttribute("role"),
                position: style.position,
                zIndex: style.zIndex,
                pointerEvents: style.pointerEvents,
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              });
              current = current.parentElement;
            }
            return result;
          })()
        }))
    ),
    popupSnapshot: await page.evaluate(() =>
      [...document.querySelectorAll('[role="tooltip"],[role="dialog"]')].map((element) => ({
        role: element.getAttribute("role"),
        classes: element.className,
        text: element.textContent?.trim().slice(0, 180),
        html: element.outerHTML.slice(0, 900)
      }))
    )
  });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
