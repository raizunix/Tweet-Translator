import { beforeEach, describe, expect, it, vi } from "vitest";
import { PadreAdapter } from "../../src/platforms/padre/adapter";

function box(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({})
  };
}

describe("Padre adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds only links to concrete X posts", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123"><svg></svg></a>
      <a id="search" href="https://x.com/search?q=token"><svg></svg></a>`;
    const adapter = new PadreAdapter();
    expect(adapter.findTwitterAnchor(document.querySelector("#post svg")!)).not.toBeNull();
    expect(adapter.findTwitterAnchor(document.querySelector("#search svg")!)).toBeNull();
  });

  it("extracts Padre main and 13px quoted tweets", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123">X</a>
      <div id="tooltip" role="tooltip"><div id="card">
        <span id="metadata" style="font-size:15px">@user</span>
        <div id="scroll" style="overflow-y:auto">
          <span id="main" style="font-size:18px">Main Padre tweet text</span>
          <span id="quote" style="font-size:13px">Quoted Padre tweet text</span>
        </div>
      </div></div>`;
    const adapter = new PadreAdapter();
    const anchor = document.querySelector("#post") as HTMLElement;
    const popup = document.querySelector("#tooltip") as HTMLElement;
    const card = document.querySelector("#card") as HTMLElement;
    const metadata = document.querySelector("#metadata") as HTMLElement;
    const scroll = document.querySelector("#scroll") as HTMLElement;
    const main = document.querySelector("#main") as HTMLElement;
    const quote = document.querySelector("#quote") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(148, 103, 16, 16));
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(4, 116, 304, 476));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(box(4, 116, 304, 476));
    vi.spyOn(metadata, "getBoundingClientRect").mockReturnValue(box(79, 173, 96, 19));
    vi.spyOn(scroll, "getBoundingClientRect").mockReturnValue(box(4, 200, 304, 392));
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(box(23, 247, 266, 246));
    vi.spyOn(quote, "getBoundingClientRect").mockReturnValue(box(32, 546, 248, 32));
    Object.defineProperty(main, "innerText", { value: main.textContent, configurable: true });
    Object.defineProperty(quote, "innerText", { value: quote.textContent, configurable: true });
    Object.defineProperties(scroll, {
      scrollHeight: { value: 760 },
      clientHeight: { value: 392 }
    });

    const match = adapter.findPopup(anchor);
    expect(match?.content).toBe(card);
    expect(match?.translationTargets.map((target) => target.text)).toEqual([
      "Main Padre tweet text",
      "Quoted Padre tweet text"
    ]);
    expect(match?.scrollContainerPath).toEqual([1]);
  });

  it("selects the complete tweet body instead of only its nested URL", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123">X</a>
      <div id="tooltip" role="tooltip"><div id="card">
        <span id="body" style="display:block;font-size:18px">
          First paragraph
          <span class="tweet-url">youtu.be/example</span>
        </span>
      </div></div>`;
    const adapter = new PadreAdapter();
    const anchor = document.querySelector("#post") as HTMLElement;
    const popup = document.querySelector("#tooltip") as HTMLElement;
    const card = document.querySelector("#card") as HTMLElement;
    const body = document.querySelector("#body") as HTMLElement;
    const url = document.querySelector(".tweet-url") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(190, 100, 16, 16));
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(4, 116, 304, 476));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(box(6, 130, 300, 460));
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue(box(20, 230, 270, 100));
    vi.spyOn(url, "getBoundingClientRect").mockReturnValue(box(20, 300, 180, 24));
    Object.defineProperty(body, "innerText", {
      value: "First paragraph\nyoutu.be/example",
      configurable: true
    });
    Object.defineProperty(url, "innerText", { value: "youtu.be/example", configurable: true });

    const match = adapter.findPopup(anchor);
    expect(match?.translationTargets).toEqual([
      expect.objectContaining({ text: "First paragraph\nyoutu.be/example" })
    ]);
  });
});
