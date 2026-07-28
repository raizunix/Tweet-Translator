import { createDomPath, type DomPath } from "../../shared/dom-path";
import type { PopupMatch, TranslationTarget } from "../types";

function normalizedText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
}

function formattedText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function visible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
  );
}

export function findAnchor(target: Element, selector: string): HTMLElement | null {
  const candidate = target.closest(selector);
  return candidate instanceof HTMLElement ? candidate : null;
}

export function isPopupTarget(target: Element, selector: string): boolean {
  return target.closest(selector) !== null;
}

export function isPointInsidePopup(x: number, y: number, selector: string): boolean {
  return [...document.querySelectorAll<HTMLElement>(selector)].some((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  });
}

export function hasVisiblePopup(selector: string): boolean {
  return [...document.querySelectorAll<HTMLElement>(selector)].some((element) => {
    if (element.closest('[data-tweet-translator="overlay"]')) return false;
    const rect = element.getBoundingClientRect();
    return visible(element) && rect.width >= 120 && rect.height >= 30;
  });
}

export function findPopupContent(popup: HTMLElement): HTMLElement {
  const child = popup.firstElementChild;
  if (!(child instanceof HTMLElement)) return popup;

  const popupRect = popup.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  const coversPopup =
    childRect.width >= popupRect.width * 0.9 && childRect.height >= popupRect.height * 0.9;
  return coversPopup ? child : popup;
}

export function findPopupNear(anchor: HTMLElement, popupSelector: string): HTMLElement | null {
  const candidates = new Set<HTMLElement>(document.querySelectorAll<HTMLElement>(popupSelector));
  for (const child of document.body.children) {
    if (child instanceof HTMLElement) candidates.add(child);
  }

  const filtered = [...candidates].filter((element) => {
    if (
      element.dataset.tweetTranslator === "overlay" ||
      !visible(element) ||
      element === anchor ||
      element.contains(anchor)
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (
      rect.width < 120 ||
      rect.height < 30 ||
      rect.width > innerWidth * 0.9 ||
      rect.height > innerHeight * 0.9 ||
      normalizedText(element).length < 2
    ) {
      return false;
    }
    const style = getComputedStyle(element);
    const semantic = element.matches(popupSelector);
    const portalRoot =
      element.parentElement === document.body &&
      style.position === "fixed" &&
      style.pointerEvents !== "none" &&
      Number.parseInt(style.zIndex, 10) >= 1000;
    return semantic || portalRoot;
  });

  if (!filtered.length) return null;
  const semantic = filtered.filter((element) => element.matches(popupSelector));
  const ranked = semantic.length ? semantic : filtered;
  const anchorRect = anchor.getBoundingClientRect();
  const distance = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return Math.hypot(
      rect.left + rect.width / 2 - (anchorRect.left + anchorRect.width / 2),
      rect.top + rect.height / 2 - (anchorRect.top + anchorRect.height / 2)
    );
  };
  return ranked.sort((left, right) => distance(left) - distance(right))[0] ?? null;
}

export function extractTranslationTargets(
  popup: HTMLElement,
  minimumFontSize = 15
): TranslationTarget[] {
  const root = findPopupContent(popup);
  const popupRect = popup.getBoundingClientRect();
  const minimumWidth = popupRect.width * 0.65;
  const contentStart = popupRect.top + Math.min(80, popupRect.height * 0.2);

  const structuralCandidates = [...root.querySelectorAll<HTMLElement>("span,p,article")].filter(
    (element) => {
      const rect = element.getBoundingClientRect();
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      return (
        visible(element) &&
        rect.top >= contentStart &&
        rect.width >= minimumWidth &&
        fontSize >= minimumFontSize &&
        normalizedText(element).length > 0
      );
    }
  );

  const blockCandidates = structuralCandidates.filter(
    (candidate) =>
      !structuralCandidates.some((other) => other !== candidate && other.contains(candidate))
  );
  const candidates = (blockCandidates.length ? blockCandidates : structuralCandidates).sort(
    (left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top
  );

  return candidates.flatMap((element) => {
    const path = createDomPath(root, element);
    const text = formattedText(element);
    const linkElements = [
      ...(element.matches("a[href]") ? [element] : []),
      ...element.querySelectorAll<HTMLAnchorElement>("a[href]")
    ].filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement);
    const links = linkElements.flatMap((link) => {
      const linkText = normalizedText(link);
      return linkText ? [{ text: linkText, href: link.href }] : [];
    });
    return path && text ? [{ path, text, links }] : [];
  });
}

export function findScrollContainerPath(popup: HTMLElement): DomPath | undefined {
  const root = findPopupContent(popup);
  const candidates = [root, ...root.querySelectorAll<HTMLElement>("div,section,article")]
    .filter((element) => {
      const style = getComputedStyle(element);
      return (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        element.getBoundingClientRect().height > 0
      );
    })
    .sort((left, right) => {
      const leftRange = Math.max(0, left.scrollHeight - left.clientHeight);
      const rightRange = Math.max(0, right.scrollHeight - right.clientHeight);
      return rightRange - leftRange;
    });
  const target = candidates[0];
  return target ? (createDomPath(root, target) ?? undefined) : undefined;
}

export function findPopupMatch(
  anchor: HTMLElement,
  popupSelector: string,
  minimumFontSize = 15
): PopupMatch | null {
  const popup = findPopupNear(anchor, popupSelector);
  if (!popup) return null;
  const translationTargets = extractTranslationTargets(popup, minimumFontSize);
  return translationTargets.length
    ? {
        popup,
        content: findPopupContent(popup),
        translationTargets,
        scrollContainerPath: findScrollContainerPath(popup)
      }
    : null;
}

export function findOpenPopupMatch(popupSelector: string, minimumFontSize = 15): PopupMatch | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(popupSelector)]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        visible(element) &&
        rect.width >= 120 &&
        rect.height >= 30 &&
        rect.width <= innerWidth * 0.9 &&
        rect.height <= innerHeight * 0.9 &&
        normalizedText(element).length >= 2
      );
    })
    .filter(
      (candidate, _index, all) =>
        !all.some((other) => other !== candidate && other.contains(candidate))
    );

  for (const popup of candidates) {
    const translationTargets = extractTranslationTargets(popup, minimumFontSize);
    if (translationTargets.length) {
      return {
        popup,
        content: findPopupContent(popup),
        translationTargets,
        scrollContainerPath: findScrollContainerPath(popup)
      };
    }
  }
  return null;
}

export function observePopupChanges(onChange: () => void): () => void {
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      onChange();
    });
  });
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "role", "aria-hidden", "hidden"],
    subtree: true
  });
  return () => observer.disconnect();
}
