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

export class GmgnAdapter implements PlatformAdapter {
  readonly id = "gmgn" as const;

  supports(url: URL): boolean {
    return url.hostname === "gmgn.ai" || url.hostname.endsWith(".gmgn.ai");
  }

  findTwitterAnchor(target: Element): HTMLElement | null {
    const link = findAnchor(target, X_LINK_SELECTOR);
    if (!link) return null;
    const hoverOwner = link.closest('button[aria-haspopup="dialog"],button[aria-haspopup="true"]');
    return hoverOwner instanceof HTMLElement ? hoverOwner : link;
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
    return findPopupMatch(anchor, POPUP_SELECTOR);
  }

  findOpenPopup(): PopupMatch | null {
    return findOpenPopupMatch(POPUP_SELECTOR);
  }

  observe(onChange: () => void): () => void {
    return observePopupChanges(onChange);
  }
}
