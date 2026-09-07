import { chromium, expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("loads the built MV3 extension", async () => {
  const path = resolve("extension");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
  });
  const workers = context.serviceWorkers();
  const worker = workers[0] ?? (await context.waitForEvent("serviceworker"));
  expect(worker.url()).toContain("background.js");
  await worker.evaluate(async () => {
    await chrome.storage.sync.set({
      settings: {
        providers: {
          google: true,
          bing: false,
          tartu: false,
          myMemory: false,
          libreTranslate: false,
          lingva: false,
          apertium: false,
          proxy: false
        },
        cryptoTerms: [],
        cryptoDictionaryVersion: 2
      }
    });
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([[["Это достаточно длинный перевод исходного сообщения."]], null, "en"]),
        { status: 200 }
      );
  });
  const workerUrl = new URL(worker.url());
  const extensionOrigin = `${workerUrl.protocol}//${workerUrl.host}`;
  const page = await context.newPage();
  await page.goto(`${extensionOrigin}/options.html`);
  await expect(page.getByRole("heading", { name: "Tweet Translator" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("extensionName");
  await expect(page.locator("body")).not.toContainText("settingsSubtitle");
  await expect(page.locator("select")).toHaveCount(2);

  await context.route("https://axiom.trade/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
        <button id="other"
          style="position:fixed;left:40px;top:100px;width:20px;height:20px">?</button>
        <a id="trigger" href="https://x.com/user/status/123"
           style="position:fixed;left:80px;top:100px;width:20px;height:20px">X</a>
        <article id="popup" data-testid="tweet"
          style="position:fixed;left:130px;top:80px;width:300px;height:300px;background:#111;color:white">
          <div style="width:300px;height:300px">
            <header style="height:80px">User profile</header>
            <span style="display:block;width:260px;font-size:18px">
              A sufficiently long original tweet body for translation
            </span>
          </div>
        </article>
        <script>
          const popup = document.querySelector("#popup");
          const body = popup.querySelector("span");
          document.querySelector("#other").addEventListener("pointerover", () => {
            body.textContent = "A sufficiently long tooltip for an unrelated toolbar action";
          });
          document.querySelector("#trigger").addEventListener("pointerover", () => {
            body.textContent = "A sufficiently long original tweet body for translation";
          });
          popup.addEventListener("mouseout", (event) => {
            if (!popup.contains(event.relatedTarget)) popup.hidden = true;
          });
        </script>
      </body></html>`
    });
  });
  const terminal = await context.newPage();
  await terminal.goto("https://axiom.trade/e2e");
  await terminal.locator("#other").hover();
  await terminal.waitForTimeout(100);
  await expect(terminal.locator('[data-tweet-translator="overlay"]')).toHaveCount(0);
  await terminal.locator("#trigger").hover();
  const overlay = terminal.locator('[data-tweet-translator="overlay"]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Это достаточно длинный перевод исходного сообщения.");
  await terminal.locator("#popup").hover();
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  await terminal.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 10 });
  await terminal.waitForTimeout(300);
  await expect(terminal.locator("#popup")).toBeVisible();
  await expect(overlay).toBeVisible();
  await context.close();
});

test("caches a closed popup and retries a failed quote without replacing the main translation", async () => {
  const path = resolve("extension");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await worker.evaluate(async () => {
      await chrome.storage.sync.set({
        settings: {
          interfaceLanguage: "en",
          providers: {
            google: true,
            bing: false,
            tartu: false,
            myMemory: false,
            libreTranslate: false,
            lingva: false,
            apertium: false,
            proxy: false
          },
          cryptoTerms: [],
          cryptoDictionaryVersion: 2
        }
      });
      const state = globalThis as unknown as {
        mainCalls: number;
        quoteCalls: number;
        releaseMain?: () => void;
      };
      state.mainCalls = 0;
      state.quoteCalls = 0;
      globalThis.fetch = async (input) => {
        const text = new URL(String(input)).searchParams.get("q") ?? "";
        if (text.includes("quoted author")) {
          state.quoteCalls++;
          if (state.quoteCalls === 1) return new Response("Unsupported pair", { status: 400 });
          return new Response(
            JSON.stringify([
              [["Автор цитаты завтра представит другой подробный отчёт."]],
              null,
              "en"
            ])
          );
        }
        state.mainCalls++;
        await new Promise<void>((resolve) => {
          state.releaseMain = resolve;
        });
        return new Response(
          JSON.stringify([[["Команда опубликует полный отчёт завтра утром."]], null, "en"])
        );
      };
    });
    await context.route("https://axiom.trade/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body>
      <button id="away" style="position:fixed;left:20px;top:20px">Away</button>
      <a id="trigger" href="https://x.com/user/status/123" style="position:fixed;left:80px;top:100px;width:20px;height:20px">X</a>
      <article id="popup" data-testid="tweet" hidden style="position:fixed;left:130px;top:80px;width:300px;height:400px;background:#111;color:white">
        <div style="width:300px;height:400px"><header style="height:80px">User profile</header>
        <span style="display:block;width:260px;font-size:18px">The team will publish the full report tomorrow morning.</span>
        <span style="display:block;width:240px;font-size:16px;margin-top:50px">The quoted author will announce another report tomorrow morning.</span></div>
      </article>
      <script>
        const popup = document.querySelector('#popup');
        document.querySelector('#trigger').addEventListener('pointerover', () => popup.hidden = false);
        document.querySelector('#away').addEventListener('pointerover', () => popup.hidden = true);
      </script></body></html>`
      })
    );
    const page = await context.newPage();
    await page.goto("https://axiom.trade/reliability");
    await page.locator("#trigger").hover();
    const overlay = page.locator('[data-tweet-translator="overlay"]');
    await expect(overlay).toBeVisible();
    await expect
      .poll(() => worker.evaluate(() => (globalThis as unknown as { mainCalls: number }).mainCalls))
      .toBe(1);
    await expect(overlay.locator("button").filter({ hasText: /^Retry$/ })).toBeVisible();
    await page.locator("#away").hover();
    await expect(overlay).toHaveCount(0);
    await worker.evaluate(() =>
      (globalThis as unknown as { releaseMain: () => void }).releaseMain()
    );
    await page.locator("#trigger").hover();
    await expect(overlay).toContainText("Команда опубликует полный отчёт завтра утром.");
    // The reopened card reuses the pending/cached main result. A failed quote
    // is retried independently and can finish without touching that main block.
    await expect(overlay).toContainText("Автор цитаты завтра представит другой подробный отчёт.");
    expect(
      await worker.evaluate(() => (globalThis as unknown as { mainCalls: number }).mainCalls)
    ).toBe(1);
  } finally {
    await context.close();
  }
});
