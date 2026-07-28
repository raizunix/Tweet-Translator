import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationOverlay } from "../../src/ui/overlay";

function rect(left: number, top: number, width: number, height: number): DOMRect {
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

describe("TranslationOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });
  });

  it("clones the complete popup and only replaces the translation target", () => {
    document.body.innerHTML = `
      <div id="popup"><div class="visual-card" style="opacity:0;transform:translateY(4px)">
        <img src="avatar.png" alt="avatar">
        <span class="tweet-body">Original text <img src="emoji.png" alt="emoji"></span>
        <div id="quoted">Quoted tweet</div>
      </div></div>`;
    const source = document.querySelector("#popup") as HTMLElement;
    const content = source.firstElementChild as HTMLElement;
    vi.spyOn(source, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const overlay = new TranslationOverlay();
    overlay.place({
      popup: source,
      content,
      translationTargets: [{ path: [1], text: "Original text" }]
    });
    overlay.success(["Переведённый текст"]);

    expect(overlay.host.querySelectorAll("img")).toHaveLength(2);
    expect((overlay.host.firstElementChild as HTMLElement).style.opacity).toBe("1");
    expect((overlay.host.firstElementChild as HTMLElement).style.transform).toBe("none");
    expect(overlay.host.querySelector("#quoted")).toBeNull();
    expect(overlay.host.textContent).toContain("Переведённый текст");
    expect(overlay.host.textContent).toContain("Quoted tweet");
    overlay.destroy();
  });

  it("preserves the content offset inside a positioned popup wrapper", () => {
    document.body.innerHTML = `
      <div id="popup"><div id="card"><span>Original text</span></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const card = document.querySelector("#card") as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(4, 116, 304, 476.5));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(rect(4, 130, 304, 460.5));

    const overlay = new TranslationOverlay();
    overlay.place({
      popup,
      content: card,
      translationTargets: [{ path: [0], text: "Original text" }]
    });

    const clone = overlay.host.firstElementChild as HTMLElement;
    expect(clone.style.top).toBe("14px");
    expect(clone.style.left).toBe("0px");
    expect(clone.style.width).toBe("304px");
    expect(clone.style.height).toBe("460.5px");
  });

  it("preserves paragraph breaks and restores original link destinations", () => {
    document.body.innerHTML = `
      <div id="popup"><div><p>First paragraph

Second paragraph

<a href="https://youtu.be/example">youtu.be/example</a></p></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const content = popup.firstElementChild as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const overlay = new TranslationOverlay();
    overlay.place({
      popup,
      content,
      translationTargets: [
        {
          path: [0],
          text: "First paragraph\n\nSecond paragraph\n\nyoutu.be/example",
          links: [{ text: "youtu.be/example", href: "https://youtu.be/example" }]
        }
      ]
    });
    overlay.success(["Первый абзац\n\nВторой абзац\n\nyoutu.be/example"]);

    const body = overlay.host.querySelector("p") as HTMLElement;
    const link = body.querySelector("a") as HTMLAnchorElement;
    expect(body.textContent).toContain("Первый абзац\n\nВторой абзац");
    expect(body.style.whiteSpace).toBe("pre-wrap");
    expect(link.href).toBe("https://youtu.be/example");
    expect(link.target).toBe("_blank");
    overlay.destroy();
  });

  it("turns a URL rendered by the site without an anchor into a safe link", () => {
    document.body.innerHTML = `
      <div id="popup"><div><p>Video: youtu.be/example?si…</p></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const content = popup.firstElementChild as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const overlay = new TranslationOverlay();
    overlay.place({
      popup,
      content,
      translationTargets: [{ path: [0], text: "Video: youtu.be/example?si…" }]
    });
    overlay.success(["Видео: youtu.be/example?si…"]);

    const link = overlay.host.querySelector("p a") as HTMLAnchorElement;
    expect(link.textContent).toBe("youtu.be/example?si…");
    expect(link.href).toBe("https://youtu.be/example?si");
    expect(link.rel).toBe("noopener noreferrer");
    overlay.destroy();
  });

  it("copies all translated blocks from the translation badge", async () => {
    document.body.innerHTML = `
      <div id="popup"><div><span>Main</span><span>Quote</span></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const content = popup.firstElementChild as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const overlay = new TranslationOverlay("ru");
    overlay.place({
      popup,
      content,
      translationTargets: [
        { path: [0], text: "Main" },
        { path: [1], text: "Quote" }
      ]
    });
    overlay.success(["Главный текст", "Цитата"]);

    const copy = overlay.host.querySelector('button[aria-label="Копировать перевод"]');
    expect(copy).toBeInstanceOf(HTMLButtonElement);
    (copy as HTMLButtonElement).click();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Главный текст\n\nЦитата");
    expect(copy?.textContent).toBe("Скопировано");
    overlay.destroy();
  });

  it("bridges the pointer gap between original and translated cards", () => {
    document.body.innerHTML = `
      <div id="popup"><div><span>Text</span></div></div>`;
    const popup = document.querySelector("#popup") as HTMLElement;
    const content = popup.firstElementChild as HTMLElement;
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const overlay = new TranslationOverlay();
    overlay.place({
      popup,
      content,
      translationTargets: [{ path: [0], text: "Text" }]
    });

    const bridge = overlay.host.querySelector(
      '[data-tweet-translator="hover-bridge"]'
    ) as HTMLElement;
    expect(overlay.host.style.left).toBe("410px");
    expect(bridge.style.width).toBe("10px");
    expect(bridge.style.left).toBe("-10px");
    overlay.destroy();
  });

  it("removes its host during cleanup", () => {
    const overlay = new TranslationOverlay();
    expect(overlay.host.isConnected).toBe(true);
    overlay.destroy();
    expect(overlay.host.isConnected).toBe(false);
  });

  it("follows popup geometry while the site's entrance animation settles", () => {
    document.body.innerHTML = `
      <div id="popup"><div><span>Text</span></div></div>`;
    const source = document.querySelector("#popup") as HTMLElement;
    const content = source.firstElementChild as HTMLElement;
    const geometry = vi
      .spyOn(source, "getBoundingClientRect")
      .mockReturnValueOnce(rect(100, 50, 240, 400))
      .mockReturnValue(rect(120, 60, 300, 500));
    const contentGeometry = vi
      .spyOn(content, "getBoundingClientRect")
      .mockReturnValueOnce(rect(100, 50, 240, 400))
      .mockReturnValue(rect(121, 61, 298, 498));
    const overlay = new TranslationOverlay();
    overlay.place({
      popup: source,
      content,
      translationTargets: [{ path: [0], text: "Text" }]
    });
    expect(overlay.host.style.width).toBe("240px");

    overlay.align(source);
    expect(geometry).toHaveBeenCalledTimes(2);
    expect(overlay.host.style.width).toBe("300px");
    expect(overlay.host.style.height).toBe("500px");
    const clone = overlay.host.firstElementChild as HTMLElement;
    expect(contentGeometry).toHaveBeenCalledTimes(2);
    expect(clone.style.left).toBe("1px");
    expect(clone.style.top).toBe("1px");
    expect(clone.style.width).toBe("298px");
    expect(clone.style.height).toBe("498px");
    overlay.destroy();
  });

  it("follows the original popup scroll position", () => {
    document.body.innerHTML = `
      <div id="popup"><div><div class="scroll"><span class="tweet">Text</span></div></div></div>`;
    const source = document.querySelector("#popup") as HTMLElement;
    const content = source.firstElementChild as HTMLElement;
    vi.spyOn(source, "getBoundingClientRect").mockReturnValue(rect(100, 50, 300, 470));
    const sourceScroller = source.querySelector(".scroll") as HTMLElement;
    const overlay = new TranslationOverlay();
    overlay.place({
      popup: source,
      content,
      translationTargets: [{ path: [0, 0], text: "Text" }],
      scrollContainerPath: [0]
    });
    const cloneScroller = overlay.host.querySelector(".scroll") as HTMLElement;
    Object.defineProperties(sourceScroller, {
      scrollHeight: { value: 600 },
      clientHeight: { value: 200 }
    });
    Object.defineProperties(cloneScroller, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 200 }
    });
    sourceScroller.scrollTop = 200;
    sourceScroller.dispatchEvent(new Event("scroll"));
    expect(cloneScroller.scrollTop).toBe(400);

    cloneScroller.scrollTop = 800;
    cloneScroller.dispatchEvent(new Event("scroll"));
    expect(sourceScroller.scrollTop).toBe(400);
    overlay.destroy();
  });
});
