import {
  findAnchor,
  findOpenPopupMatch,
  findPopupMatch,
  hasVisiblePopup,
  isPointInsidePopup,
  isPopupTarget,
  observePopupChanges
} from "../shared/twitter-popup";
import type { PlatformAdapter, PopupMatch } from "../types";
import { POPUP_SELECTOR, X_LINK_SELECTOR } from "./selectors";

export class PadreAdapter implements PlatformAdapter {
  readonly id = "padre" as const;

  supports(url: URL): boolean {
    return url.hostname === "trade.padre.gg";
  }

  findTwitterAnchor(target: Element): HTMLElement | null {
    return findAnchor(target, X_LINK_SELECTOR);
  }

  isPopupTarget(target: Element): boolean {
    return isPopupTarget(target, POPUP_SELECTOR);
  }

  isPointInsidePopup(x: number, y: number): boolean {
    return isPointInsidePopup(x, y, POPUP_SELECTOR);
  }

  hasVisiblePopup(): boolean {
    return hasVisiblePopup(POPUP_SELECTOR);
  }

  findPopup(anchor: HTMLElement): PopupMatch | null {
    // Quoted tweets in Padre use a smaller 13px font than the primary tweet.
    return findPopupMatch(anchor, POPUP_SELECTOR, 13);
  }

  findOpenPopup(): PopupMatch | null {
    return findOpenPopupMatch(POPUP_SELECTOR, 13);
  }

  observe(onChange: () => void): () => void {
    return observePopupChanges(onChange);
  }
}
