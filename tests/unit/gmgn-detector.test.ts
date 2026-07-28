import { beforeEach, describe, expect, it, vi } from "vitest";
import { GmgnAdapter } from "../../src/platforms/gmgn/adapter";
import { observePopupChanges } from "../../src/platforms/shared/twitter-popup";

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

describe("GMGN adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds only links to concrete X posts", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123"><svg></svg></a>
      <a id="community" href="https://x.com/i/communities/456"><svg></svg></a>`;
    const adapter = new GmgnAdapter();
    expect(adapter.findTwitterAnchor(document.querySelector("#post svg")!)).not.toBeNull();
    expect(adapter.findTwitterAnchor(document.querySelector("#community svg")!)).toBeNull();
  });

  it("uses GMGN's popup trigger button as the hover lifecycle owner", () => {
    document.body.innerHTML = `
      <button id="owner" aria-haspopup="dialog">
        <a href="https://x.com/user/status/123"><svg id="icon"></svg></a>
      </button>`;
    const adapter = new GmgnAdapter();

    expect(adapter.findTwitterAnchor(document.querySelector("#icon")!)).toBe(
      document.querySelector("#owner")
    );
  });

  it("waits for a loaded tooltip and extracts main and quoted tweets", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123">X</a>
      <div id="tooltip" role="tooltip"><div id="card">
        <span id="metadata" style="font-size:14px">User metadata</span>
        <div id="scroll" style="overflow-y:auto">
          <span id="main" style="font-size:15px">Main tweet text</span>
          <span id="quote" style="font-size:15px">Quoted tweet text</span>
        </div>
      </div></div>`;
    const adapter = new GmgnAdapter();
    const anchor = document.querySelector("#post") as HTMLElement;
    const popup = document.querySelector("#tooltip") as HTMLElement;
    const card = document.querySelector("#card") as HTMLElement;
    const metadata = document.querySelector("#metadata") as HTMLElement;
    const scroll = document.querySelector("#scroll") as HTMLElement;
    const main = document.querySelector("#main") as HTMLElement;
    const quote = document.querySelector("#quote") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(690, 128, 15, 15));
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(545, 150, 302, 522));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(box(546, 151, 300, 520));
    vi.spyOn(metadata, "getBoundingClientRect").mockReturnValue(box(560, 170, 270, 20));
    vi.spyOn(scroll, "getBoundingClientRect").mockReturnValue(box(546, 220, 300, 450));
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(box(560, 260, 270, 72));
    vi.spyOn(quote, "getBoundingClientRect").mockReturnValue(box(560, 360, 270, 96));
    Object.defineProperty(main, "innerText", { value: main.textContent, configurable: true });
    Object.defineProperty(quote, "innerText", { value: quote.textContent, configurable: true });
    Object.defineProperties(scroll, {
      scrollHeight: { value: 700 },
      clientHeight: { value: 450 }
    });

    const match = adapter.findPopup(anchor);
    expect(match?.content).toBe(card);
    expect(match?.translationTargets.map((target) => target.text)).toEqual([
      "Main tweet text",
      "Quoted tweet text"
    ]);
    expect(match?.scrollContainerPath).toEqual([1]);
    expect(adapter.findOpenPopup()?.translationTargets.map((target) => target.text)).toEqual([
      "Main tweet text",
      "Quoted tweet text"
    ]);
  });

  it("ignores an empty skeleton tooltip", () => {
    document.body.innerHTML = `
      <a id="post" href="https://x.com/user/status/123">X</a>
      <div id="tooltip" role="tooltip"><div class="animate-pulse"></div></div>`;
    const adapter = new GmgnAdapter();
    const anchor = document.querySelector("#post") as HTMLElement;
    const popup = document.querySelector("#tooltip") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(690, 128, 15, 15));
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(545, 150, 302, 285));
    expect(adapter.isPopupTarget(popup.firstElementChild!)).toBe(true);
    expect(adapter.findPopup(anchor)).toBeNull();
  });

  it("keeps waiting while the pointer is on GMGN's outer tooltip wrapper", () => {
    document.body.innerHTML = `
      <div class="pi-tooltip"><div class="pi-tooltip-container">
        <div class="animate-pulse"></div>
      </div></div>`;
    const adapter = new GmgnAdapter();
    const wrapper = document.querySelector(".pi-tooltip") as HTMLElement;
    const skeleton = document.querySelector(".animate-pulse")!;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(box(500, 200, 302, 285));
    expect(adapter.isPopupTarget(skeleton)).toBe(true);
    expect(adapter.isPointInsidePopup(600, 300)).toBe(true);
    expect(adapter.hasVisiblePopup()).toBe(true);
  });

  it("notifies when GMGN fills an existing popup skeleton", async () => {
    document.body.innerHTML = `<div role="tooltip"><span id="tweet">Loading</span></div>`;
    const onChange = vi.fn();
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const stop = observePopupChanges(onChange);

    document.querySelector("#tweet")!.firstChild!.nodeValue = "Tweet loaded asynchronously";
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    frame.mockRestore();
  });
});
