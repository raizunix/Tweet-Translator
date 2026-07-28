import type { DomPath } from "../shared/dom-path";

export interface TranslationTarget {
  path: DomPath;
  text: string;
  links?: Array<{ text: string; href: string }>;
}

export interface PopupMatch {
  popup: HTMLElement;
  content: HTMLElement;
  translationTargets: TranslationTarget[];
  scrollContainerPath?: DomPath;
}

export interface PlatformAdapter {
  readonly id: "axiom" | "gmgn" | "padre";
  supports(url: URL): boolean;
  findTwitterAnchor(target: Element): HTMLElement | null;
  isPopupTarget(target: Element): boolean;
  isPointInsidePopup(x: number, y: number): boolean;
  hasVisiblePopup(): boolean;
  findPopup(anchor: HTMLElement): PopupMatch | null;
  findOpenPopup(): PopupMatch | null;
  observe(onChange: () => void): () => void;
}
