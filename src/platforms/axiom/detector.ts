import {
  extractTranslationTargets,
  findAnchor,
  findPopupContent,
  findPopupNear as findSharedPopupNear,
  findScrollContainerPath
} from "../shared/twitter-popup";
import type { PopupMatch } from "../types";
import { POPUP_SELECTOR, X_LINK_SELECTOR } from "./selectors";

export { extractTranslationTargets, findPopupContent, findScrollContainerPath };

export function findXAnchor(target: Element): HTMLElement | null {
  return findAnchor(target, X_LINK_SELECTOR);
}

export function findPopupNear(anchor: HTMLElement): HTMLElement | null {
  return findAxiomTwitterPopup(anchor) ?? findSharedPopupNear(anchor, POPUP_SELECTOR);
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width >= 240 &&
    rect.height >= 120 &&
    rect.width <= innerWidth * 0.9 &&
    rect.height <= innerHeight * 0.95 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

export function hasAxiomTwitterSignature(element: HTMLElement): boolean {
  const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ");
  return (
    /@[A-Za-z0-9_]{1,15}\b/.test(text) &&
    /\bJoined\s+[A-Z][a-z]{2,8}\s+\d{4}/.test(text) &&
    /\b\d[\d,.]*[KMBkmb]?\s+followers?\b/i.test(text)
  );
}

export function findAxiomTwitterPopup(anchor?: HTMLElement): HTMLElement | null {
  const candidates = [...document.body.children].filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement) || element.dataset.tweetTranslator === "overlay")
      return false;
    const style = getComputedStyle(element);
    return (
      isVisible(element) &&
      style.position === "fixed" &&
      Number.parseInt(style.zIndex, 10) >= 1000 &&
      hasAxiomTwitterSignature(element)
    );
  });
  if (!anchor || candidates.length < 2) return candidates[0] ?? null;
  const anchorRect = anchor.getBoundingClientRect();
  const distance = (popup: HTMLElement) => {
    const rect = popup.getBoundingClientRect();
    return Math.hypot(
      rect.left + rect.width / 2 - (anchorRect.left + anchorRect.width / 2),
      rect.top + rect.height / 2 - (anchorRect.top + anchorRect.height / 2)
    );
  };
  return candidates.sort((left, right) => distance(left) - distance(right))[0] ?? null;
}

export function findAxiomPopupMatch(anchor?: HTMLElement): PopupMatch | null {
  const popup = anchor ? findPopupNear(anchor) : findAxiomTwitterPopup();
  if (!popup) return null;
  const translationTargets = extractTranslationTargets(popup);
  return translationTargets.length
    ? {
        popup,
        content: findPopupContent(popup),
        translationTargets,
        scrollContainerPath: findScrollContainerPath(popup)
      }
    : null;
}

export function isInsideAxiomTwitterPopup(target: Element): boolean {
  return findAxiomTwitterPopup()?.contains(target) ?? false;
}

export function isPointInsideAxiomTwitterPopup(x: number, y: number): boolean {
  const popup = findAxiomTwitterPopup();
  if (!popup) return false;
  const rect = popup.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
