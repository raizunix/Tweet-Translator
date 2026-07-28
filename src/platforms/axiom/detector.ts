import {
  extractTranslationTargets,
  findAnchor,
  findPopupContent,
  findPopupNear as findSharedPopupNear,
  findScrollContainerPath
} from "../shared/twitter-popup";
import { POPUP_SELECTOR, X_LINK_SELECTOR } from "./selectors";

export { extractTranslationTargets, findPopupContent, findScrollContainerPath };

export function findXAnchor(target: Element): HTMLElement | null {
  return findAnchor(target, X_LINK_SELECTOR);
}

export function findPopupNear(anchor: HTMLElement): HTMLElement | null {
  return findSharedPopupNear(anchor, POPUP_SELECTOR);
}
