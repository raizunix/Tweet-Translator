import type { PopupMatch, TranslationTarget } from "../platforms/types";
import { resolveDomPath, type DomPath } from "../shared/dom-path";
import { calculatePosition } from "./position";

type OverlayLanguage = "ru" | "en";

const overlayMessages = {
  ru: {
    translating: "Переводим…",
    retry: "Повторить",
    badge: "Перевод",
    copy: "Копировать перевод",
    copied: "Скопировано"
  },
  en: {
    translating: "Translating…",
    retry: "Retry",
    badge: "Translation",
    copy: "Copy translation",
    copied: "Copied"
  }
} as const;

export class TranslationOverlay {
  readonly host = document.createElement("div");
  private card?: HTMLElement;
  private bodies: HTMLElement[] = [];
  private preservedMedia: HTMLElement[][] = [];
  private targetLinks: Array<Array<{ text: string; href: string }>> = [];
  private readonly retryButtons = new Set<HTMLButtonElement>();
  private copyButton?: HTMLButtonElement;
  private reloadButton?: HTMLButtonElement;
  private hoverBridge?: HTMLElement;
  private translatedTexts: string[] = [];
  private sourceContent?: HTMLElement;
  private clonedContent?: HTMLElement;
  private sourceScroller?: HTMLElement;
  private cloneScroller?: HTMLElement;
  private syncingScroll = false;

  private readonly syncFromSource = () => {
    this.syncScrollProgress(this.sourceScroller, this.cloneScroller);
  };

  private readonly syncFromClone = () => {
    this.syncScrollProgress(this.cloneScroller, this.sourceScroller);
  };

  constructor(private readonly language: OverlayLanguage = "en") {
    this.host.dataset.tweetTranslator = "overlay";
    this.host.style.cssText = "position:fixed;z-index:9999;left:0;top:0;pointer-events:auto;";
    this.host.addEventListener(
      "click",
      (event) => {
        if (
          this.retryButtons.has(event.target as HTMLButtonElement) ||
          event.target === this.copyButton ||
          event.target === this.reloadButton
        )
          return;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
    // Light-DOM cloning keeps the host page's inherited fonts and icon styles.
    document.body.append(this.host);
  }

  place(match: PopupMatch): void {
    const popupRect = match.popup.getBoundingClientRect();
    if (!this.card) {
      this.cloneSource(
        popupRect,
        match.content,
        match.translationTargets,
        match.scrollContainerPath
      );
    }
    this.alignRect(popupRect);
  }

  align(source: HTMLElement): void {
    const sourceRect = source.getBoundingClientRect();
    this.alignRect(sourceRect);
    this.syncContentGeometry(sourceRect);
  }

  private alignRect(sourceRect: DOMRect): void {
    const position = calculatePosition(
      sourceRect,
      { width: sourceRect.width, height: sourceRect.height },
      { width: innerWidth, height: innerHeight }
    );
    this.host.style.width = `${sourceRect.width}px`;
    this.host.style.height = `${sourceRect.height}px`;
    this.host.style.left = `${position.left}px`;
    this.host.style.top = `${position.top}px`;
    this.alignHoverBridge(sourceRect, position.left);
  }

  loading(): void {
    this.translatedTexts = [];
    this.bodies.forEach((_body, index) => this.loadingBlock(index));
  }

  success(texts: string[], retry?: () => void): void {
    this.translatedTexts = texts.filter(Boolean);
    if (this.copyButton) this.copyButton.disabled = this.translatedTexts.length === 0;
    this.setReloadHandler(retry);
    texts.forEach((text, index) => this.renderBody(index, text));
  }

  error(message: string, retry: () => void): void {
    this.errorBlock(0, message, retry);
    this.setReloadHandler(retry);
  }

  loadingBlock(index: number): void {
    this.translatedTexts[index] = "";
    this.updateCopyButton();
    this.setReloadHandler();
    this.renderBody(index, overlayMessages[this.language].translating);
  }

  successBlock(index: number, text: string): void {
    this.translatedTexts[index] = text;
    this.updateCopyButton();
    this.renderBody(index, text);
  }

  errorBlock(index: number, message: string, retry: () => void): void {
    const body = this.bodies[index];
    if (!body) return;
    this.translatedTexts[index] = "";
    this.updateCopyButton();
    this.renderBody(index, message);
    body.style.color = "#ff9d9d";
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = overlayMessages[this.language].retry;
    retryButton.style.cssText =
      "display:block;margin-top:12px;padding:6px 10px;border:1px solid #425464;border-radius:7px;background:#253341;color:#fff;cursor:pointer";
    retryButton.addEventListener("click", retry, { once: true });
    this.retryButtons.add(retryButton);
    body.append(retryButton);
  }

  private updateCopyButton(): void {
    if (this.copyButton) this.copyButton.disabled = !this.translatedTexts.some(Boolean);
  }

  destroy(): void {
    this.sourceScroller?.removeEventListener("scroll", this.syncFromSource);
    this.cloneScroller?.removeEventListener("scroll", this.syncFromClone);
    this.host.remove();
  }

  private cloneSource(
    popupRect: DOMRect,
    sourceContent: HTMLElement,
    translationTargets: TranslationTarget[],
    scrollContainerPath?: DomPath
  ): void {
    const clone = sourceContent.cloneNode(true) as HTMLElement;
    const contentRect = sourceContent.getBoundingClientRect();
    const contentLeft = contentRect.left - popupRect.left;
    const contentTop = contentRect.top - popupRect.top;
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.querySelectorAll<HTMLMediaElement>("video,audio").forEach((media) => {
      media.pause();
      media.removeAttribute("autoplay");
    });
    clone.querySelectorAll("form").forEach((form) => form.removeAttribute("action"));
    // The portal wrapper is animated by React. A reused popup can be cloned
    // during its exit state (opacity: 0), but React will never update our clone.
    // Pin only this transport wrapper to its final visible state.
    clone.style.opacity = "1";
    clone.style.visibility = "visible";
    clone.style.transform = "none";
    clone.style.transition = "none";
    // Some sites position the visual card through a selector on the portal
    // wrapper (for example, Padre's tooltip placement margin). The wrapper is
    // intentionally not cloned, so preserve the measured content box here.
    clone.style.position = "absolute";
    clone.style.margin = "0";
    clone.style.left = `${contentLeft}px`;
    clone.style.top = `${contentTop}px`;
    clone.style.width = `${contentRect.width}px`;
    clone.style.height = `${contentRect.height}px`;
    this.sourceContent = sourceContent;
    this.clonedContent = clone;

    this.bodies = translationTargets
      .map((target) => resolveDomPath(clone, target.path))
      .filter((element): element is HTMLElement => element !== null);
    this.targetLinks = translationTargets.map((target) => target.links ?? []);
    this.preservedMedia = this.bodies.map((body) =>
      [...body.querySelectorAll<HTMLElement>("picture,img,video")].filter(
        (element) => element.tagName !== "IMG" || !element.closest("picture")
      )
    );

    if (scrollContainerPath) {
      this.sourceScroller = resolveDomPath(sourceContent, scrollContainerPath) ?? undefined;
      this.cloneScroller = resolveDomPath(clone, scrollContainerPath) ?? undefined;
      this.sourceScroller?.addEventListener("scroll", this.syncFromSource, { passive: true });
      this.cloneScroller?.addEventListener("scroll", this.syncFromClone, { passive: true });
    }

    this.card = clone;
    this.host.replaceChildren(clone);
    this.syncFromSource();

    this.copyButton = document.createElement("button");
    this.copyButton.type = "button";
    this.copyButton.disabled = true;
    this.copyButton.textContent = `${overlayMessages[this.language].badge} ⧉`;
    this.copyButton.title = overlayMessages[this.language].copy;
    this.copyButton.setAttribute("aria-label", overlayMessages[this.language].copy);
    this.copyButton.dataset.tweetTranslator = "badge";
    this.copyButton.style.cssText =
      "position:absolute;right:38px;top:8px;z-index:2147483647;display:block;opacity:1;visibility:visible;padding:3px 7px;border:1px solid #536779;border-radius:5px;background:#253341;color:#d7e5f0;box-shadow:0 1px 4px #0008;font:700 10px/16px Geist,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;cursor:pointer";
    this.copyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.copyTranslation();
    });
    this.host.append(this.copyButton);

    this.reloadButton = document.createElement("button");
    this.reloadButton.type = "button";
    this.reloadButton.disabled = true;
    this.reloadButton.textContent = "↻";
    this.reloadButton.title = overlayMessages[this.language].retry;
    this.reloadButton.setAttribute("aria-label", overlayMessages[this.language].retry);
    this.reloadButton.dataset.tweetTranslator = "reload";
    this.reloadButton.style.cssText =
      "position:absolute;right:8px;top:8px;z-index:2147483647;width:24px;height:24px;padding:0;border:1px solid #536779;border-radius:5px;background:#253341;color:#d7e5f0;box-shadow:0 1px 4px #0008;font:700 16px/22px system-ui,sans-serif;cursor:pointer";
    this.host.append(this.reloadButton);

    this.hoverBridge = document.createElement("span");
    this.hoverBridge.dataset.tweetTranslator = "hover-bridge";
    this.hoverBridge.style.cssText =
      "position:absolute;top:0;height:100%;background:transparent;pointer-events:auto";
    this.host.append(this.hoverBridge);
  }

  private alignHoverBridge(sourceRect: DOMRect, overlayLeft: number): void {
    if (!this.hoverBridge) return;
    const overlayRight = overlayLeft + sourceRect.width;
    const isRight = overlayLeft >= sourceRect.right;
    const gap = isRight ? overlayLeft - sourceRect.right : sourceRect.left - overlayRight;
    this.hoverBridge.style.width = `${Math.max(0, gap)}px`;
    this.hoverBridge.style.left = isRight ? `${-Math.max(0, gap)}px` : "auto";
    this.hoverBridge.style.right = isRight ? "auto" : `${-Math.max(0, gap)}px`;
  }

  private syncContentGeometry(popupRect: DOMRect): void {
    if (!this.sourceContent || !this.clonedContent) return;
    const contentRect = this.sourceContent.getBoundingClientRect();
    this.clonedContent.style.left = `${contentRect.left - popupRect.left}px`;
    this.clonedContent.style.top = `${contentRect.top - popupRect.top}px`;
    this.clonedContent.style.width = `${contentRect.width}px`;
    this.clonedContent.style.height = `${contentRect.height}px`;
  }

  private async copyTranslation(): Promise<void> {
    if (!this.copyButton || this.translatedTexts.length === 0) return;
    try {
      await navigator.clipboard.writeText(this.translatedTexts.filter(Boolean).join("\n\n"));
      this.copyButton.textContent = overlayMessages[this.language].copied;
      setTimeout(() => {
        if (this.copyButton?.isConnected) {
          this.copyButton.textContent = `${overlayMessages[this.language].badge} ⧉`;
        }
      }, 1_200);
    } catch {
      // Clipboard access may be blocked by browser or OS policy.
    }
  }

  setReloadHandler(retry?: () => void): void {
    if (!this.reloadButton) return;
    const replacement = this.reloadButton.cloneNode(true) as HTMLButtonElement;
    replacement.disabled = !retry;
    if (retry) replacement.addEventListener("click", retry, { once: true });
    this.reloadButton.replaceWith(replacement);
    this.reloadButton = replacement;
  }

  private renderBody(index: number, text: string): void {
    const body = this.bodies[index];
    if (!body) return;
    for (const button of this.retryButtons) {
      if (body.contains(button)) this.retryButtons.delete(button);
    }
    body.style.removeProperty("color");
    body.style.whiteSpace = "pre-wrap";
    const media = (this.preservedMedia[index] ?? []).map((element) => element.cloneNode(true));
    body.replaceChildren(this.renderLinkedText(text, this.targetLinks[index] ?? []), ...media);
    this.syncFromSource();
  }

  private renderLinkedText(
    text: string,
    links: Array<{ text: string; href: string }>
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const inferredLinks = [
      ...text.matchAll(/\b(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}\/\S*/gi)
    ]
      .map((match) => match[0].replace(/[),.;!?]+$/, ""))
      .filter(Boolean)
      .map((displayText) => ({
        text: displayText,
        href: `${/^https?:\/\//i.test(displayText) ? "" : "https://"}${displayText.replace(
          /[…]+$/,
          ""
        )}`
      }));
    const allLinks = [...links, ...inferredLinks];
    const remaining = allLinks.filter(
      (link, index) =>
        link.text && allLinks.findIndex((other) => other.text === link.text) === index
    );
    let cursor = 0;

    while (cursor < text.length) {
      let next: { index: number; link: { text: string; href: string } } | undefined;
      for (const link of remaining) {
        const index = text.toLocaleLowerCase().indexOf(link.text.toLocaleLowerCase(), cursor);
        if (index >= 0 && (!next || index < next.index)) next = { index, link };
      }
      if (!next) {
        fragment.append(document.createTextNode(text.slice(cursor)));
        break;
      }
      if (next.index > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, next.index)));
      }
      const anchor = document.createElement("a");
      anchor.href = next.link.href;
      anchor.textContent = text.slice(next.index, next.index + next.link.text.length);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.color = "#1d9bf0";
      anchor.style.textDecoration = "none";
      fragment.append(anchor);
      cursor = next.index + next.link.text.length;
      remaining.splice(remaining.indexOf(next.link), 1);
    }
    return fragment;
  }

  private syncScrollProgress(
    source: HTMLElement | undefined,
    destination: HTMLElement | undefined
  ): void {
    if (!source || !destination || this.syncingScroll) return;

    const sourceVerticalRange = Math.max(0, source.scrollHeight - source.clientHeight);
    const destinationVerticalRange = Math.max(
      0,
      destination.scrollHeight - destination.clientHeight
    );
    const sourceHorizontalRange = Math.max(0, source.scrollWidth - source.clientWidth);
    const destinationHorizontalRange = Math.max(
      0,
      destination.scrollWidth - destination.clientWidth
    );
    const verticalProgress = sourceVerticalRange > 0 ? source.scrollTop / sourceVerticalRange : 0;
    const horizontalProgress =
      sourceHorizontalRange > 0 ? source.scrollLeft / sourceHorizontalRange : 0;

    this.syncingScroll = true;
    destination.scrollTop = verticalProgress * destinationVerticalRange;
    destination.scrollLeft = horizontalProgress * destinationHorizontalRange;
    this.syncingScroll = false;
  }
}
