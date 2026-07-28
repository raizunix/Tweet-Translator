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
  const workerUrl = new URL(worker.url());
  const extensionOrigin = `${workerUrl.protocol}//${workerUrl.host}`;
  const page = await context.newPage();
  await page.goto(`${extensionOrigin}/options.html`);
  await expect(page.getByRole("heading", { name: "Tweet Translator" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("extensionName");
  await expect(page.locator("body")).not.toContainText("settingsSubtitle");
  await expect(page.locator("select")).toHaveCount(3);

  await context.route("https://axiom.trade/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
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
          popup.addEventListener("mouseout", (event) => {
            if (!popup.contains(event.relatedTarget)) popup.hidden = true;
          });
        </script>
      </body></html>`
    });
  });
  const terminal = await context.newPage();
  await terminal.goto("https://axiom.trade/e2e");
  await terminal.locator("#trigger").hover();
  const overlay = terminal.locator('[data-tweet-translator="overlay"]');
  await expect(overlay).toBeVisible();
  await terminal.locator("#popup").hover();
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  await terminal.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 10 });
  await terminal.waitForTimeout(300);
  await expect(terminal.locator("#popup")).toBeVisible();
  await expect(overlay).toBeVisible();
  await context.close();
});
