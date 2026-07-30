import {
  hasVisiblePopup as hasSharedVisiblePopup,
  isPointInsidePopup as isPointInsideSharedPopup,
  isPopupTarget as isSharedPopupTarget,
  observePopupChanges
} from "../shared/twitter-popup";
import type { PlatformAdapter, PopupMatch } from "../types";
import {
  findAxiomPopupMatch,
  findAxiomTwitterPopup,
  findXAnchor,
  isInsideAxiomTwitterPopup,
  isPointInsideAxiomTwitterPopup
} from "./detector";
import { POPUP_SELECTOR } from "./selectors";

export class AxiomAdapter implements PlatformAdapter {
  readonly id = "axiom" as const;
  readonly detectsPopupIndependently = true;
  supports(url: URL): boolean {
    return url.hostname === "axiom.trade" || url.hostname.endsWith(".axiom.trade");
  }
  findTwitterAnchor(target: Element): HTMLElement | null {
    return findXAnchor(target);
  }
  isPopupTarget(target: Element): boolean {
    return isInsideAxiomTwitterPopup(target) || isSharedPopupTarget(target, POPUP_SELECTOR);
  }
  isPointInsidePopup(x: number, y: number): boolean {
    return isPointInsideAxiomTwitterPopup(x, y) || isPointInsideSharedPopup(x, y, POPUP_SELECTOR);
  }
  hasVisiblePopup(): boolean {
    return Boolean(findAxiomTwitterPopup()) || hasSharedVisiblePopup(POPUP_SELECTOR);
  }
  findPopup(anchor: HTMLElement): PopupMatch | null {
    return findAxiomPopupMatch(anchor);
  }
  findOpenPopup(): PopupMatch | null {
    return findAxiomPopupMatch();
  }
  observe(onChange: () => void): () => void {
    return observePopupChanges(onChange);
  }
}
