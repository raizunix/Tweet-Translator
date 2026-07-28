import {
  findOpenPopupMatch,
  findPopupMatch,
  hasVisiblePopup,
  isPointInsidePopup,
  isPopupTarget,
  observePopupChanges
} from "../shared/twitter-popup";
import type { PlatformAdapter, PopupMatch } from "../types";
import { findXAnchor } from "./detector";
import { POPUP_SELECTOR } from "./selectors";

export class AxiomAdapter implements PlatformAdapter {
  readonly id = "axiom" as const;
  supports(url: URL): boolean {
    return url.hostname === "axiom.trade" || url.hostname.endsWith(".axiom.trade");
  }
  findTwitterAnchor(target: Element): HTMLElement | null {
    return findXAnchor(target);
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
