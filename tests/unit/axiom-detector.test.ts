import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractTranslationTargets,
  findPopupContent,
  findPopupNear,
  findScrollContainerPath,
  findXAnchor
} from "../../src/platforms/axiom/detector";

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

describe("Axiom detector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds the quill icon through its X status link", () => {
    document.body.innerHTML =
      '<a href="https://x.com/user/status/123"><i class="ri-quill-pen-line"></i></a>';
    expect(findXAnchor(document.querySelector("i")!)?.tagName).toBe("A");
  });

  it("ignores X search links that are not tweets", () => {
    document.body.innerHTML =
      '<a href="https://x.com/search?q=token"><i class="ri-search-line"></i></a>';
    expect(findXAnchor(document.querySelector("i")!)).toBeNull();
  });

  it("extracts only the primary tweet body from an Axiom popup", () => {
    document.body.innerHTML = `
      <div id="popup"><div>
        <span id="metadata" style="font-size:14px">profile metadata 13m 75 followers</span>
        <span id="main" style="font-size:18px">The actual tweet body</span>
        <span id="quote" style="font-size:16px">Quoted tweet body</span>
      </div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const content = popup.firstElementChild as HTMLElement;
    const metadata = popup.querySelector("#metadata") as HTMLElement;
    const main = popup.querySelector("#main") as HTMLElement;
    const quote = popup.querySelector("#quote") as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(0, 0, 300, 500));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(box(0, 0, 300, 500));
    vi.spyOn(metadata, "getBoundingClientRect").mockReturnValue(box(20, 20, 260, 24));
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(box(20, 120, 260, 80));
    vi.spyOn(quote, "getBoundingClientRect").mockReturnValue(box(30, 240, 240, 60));
    Object.defineProperty(main, "innerText", { value: main.textContent, configurable: true });
    Object.defineProperty(quote, "innerText", { value: quote.textContent, configurable: true });
    expect(findPopupContent(popup)).toBe(content);
    expect(extractTranslationTargets(popup).map((target) => target.text)).toEqual([
      "The actual tweet body",
      "Quoted tweet body"
    ]);
  });

  it("keeps a semantic popup as the content root when its first child is only a header", () => {
    document.body.innerHTML = `
      <article id="popup" data-testid="tweet">
        <header id="header">Profile</header>
        <p>Tweet body</p>
      </article>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const header = document.querySelector("#header") as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(box(0, 0, 300, 400));
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(box(0, 0, 300, 60));
    expect(findPopupContent(popup)).toBe(popup);
  });

  it("finds a React Tweet fallback rendered outside the pulse row", () => {
    document.body.innerHTML = `
      <div data-pulse-token-address="token"><a href="https://x.com/user/status/123"><i class="ri-quill-pen-line"></i></a></div>
      <article data-testid="tweet">This is a sufficiently long tweet rendered by React Tweet.</article>`;
    const anchor = document.querySelector("a") as HTMLElement;
    const tweet = document.querySelector("article") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(100, 100, 16, 16));
    vi.spyOn(tweet, "getBoundingClientRect").mockReturnValue(box(130, 80, 320, 180));
    Object.defineProperty(tweet, "innerText", { value: tweet.textContent, configurable: true });
    expect(findPopupNear(anchor)).toBe(tweet);
  });

  it("finds the popup scroll container structurally", () => {
    document.body.innerHTML = `
      <div id="popup"><div><div id="scroll" style="overflow-y:auto">content</div></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const scroll = popup.querySelector("#scroll") as HTMLElement;
    vi.spyOn(scroll, "getBoundingClientRect").mockReturnValue(box(0, 0, 300, 400));
    Object.defineProperties(scroll, {
      scrollHeight: { value: 800 },
      clientHeight: { value: 400 }
    });
    expect(findScrollContainerPath(popup)).toEqual([0]);
  });

  it("prefers the React Tweet root over a closer positioned child", () => {
    document.body.innerHTML = `
      <div data-pulse-token-address="token"><a href="https://x.com/user/status/123">X</a></div>
      <article data-testid="tweet">A stable tweet root with enough readable content.
        <div class="fixed">A closer nested element with enough text.</div>
      </article>`;
    const anchor = document.querySelector("a") as HTMLElement;
    const tweet = document.querySelector("article") as HTMLElement;
    const child = document.querySelector(".fixed") as HTMLElement;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(box(100, 100, 16, 16));
    vi.spyOn(tweet, "getBoundingClientRect").mockReturnValue(box(140, 60, 320, 240));
    vi.spyOn(child, "getBoundingClientRect").mockReturnValue(box(120, 100, 180, 80));
    Object.defineProperty(tweet, "innerText", { value: tweet.textContent, configurable: true });
    Object.defineProperty(child, "innerText", { value: child.textContent, configurable: true });
    expect(findPopupNear(anchor)).toBe(tweet);
  });
});
