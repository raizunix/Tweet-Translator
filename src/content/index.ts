import { adapterFor } from "../platforms/registry";
import type { PopupMatch } from "../platforms/types";
import type { Settings } from "../shared/settings";
import { createTranslationProvider } from "../translation/provider-factory";
import { Translator } from "../translation/translator";
import { DEFAULT_CRYPTO_TERMS } from "../translation/text-protection";
import { TranslationOverlay } from "../ui/overlay";

const message = (key: string, fallback: string) =>
  globalThis.chrome?.i18n?.getMessage(key) || fallback;

async function loadContentSettings(): Promise<Settings> {
  // Keep this loader inside the content entrypoint. Sharing its runtime module
  // with the options page makes Rollup emit an ESM import, which Chrome does
  // not allow in a manifest content script.
  const defaults: Settings = {
    enabled: true,
    platforms: { axiom: true, gmgn: true, padre: true },
    interfaceLanguage: "auto",
    targetLanguage: "ru",
    providers: {
      google: true,
      bing: true,
      tartu: true,
      myMemory: true,
      libreTranslate: true,
      lingva: true,
      apertium: true,
      proxy: false
    },
    proxyUrl: "",
    cryptoTerms: DEFAULT_CRYPTO_TERMS,
    cryptoDictionaryVersion: 2
  };
  const stored = await chrome.storage.sync.get("settings");
  const raw = stored.settings as Partial<Settings> | undefined;
  const settings: Settings = {
    ...defaults,
    ...raw,
    platforms: { ...defaults.platforms, ...raw?.platforms },
    providers: { ...defaults.providers, ...raw?.providers },
    cryptoTerms:
      raw?.cryptoDictionaryVersion === defaults.cryptoDictionaryVersion &&
      Array.isArray(raw?.cryptoTerms)
        ? raw.cryptoTerms
        : [
            ...new Set([
              ...defaults.cryptoTerms,
              ...(Array.isArray(raw?.cryptoTerms) ? raw.cryptoTerms : [])
            ])
          ],
    cryptoDictionaryVersion: defaults.cryptoDictionaryVersion
  };
  return settings;
}

void (async () => {
  const settings = await loadContentSettings();
  const browserLanguage = chrome.i18n.getUILanguage() || navigator.language || "en";
  const interfaceLanguage =
    settings.interfaceLanguage === "auto"
      ? browserLanguage.toLowerCase().startsWith("ru")
        ? "ru"
        : "en"
      : settings.interfaceLanguage;
  const adapter = adapterFor(new URL(location.href));
  if (!settings.enabled || !adapter || !settings.platforms[adapter.id]) return;
  const provider = createTranslationProvider(settings);
  const translator = new Translator(provider, 12_000, 2, 200, settings.cryptoTerms);
  let anchor: HTMLElement | null = null;
  let anchorUrl: string | undefined;
  let anchorCenter: { x: number; y: number } | undefined;
  let activePopup: HTMLElement | null = null;
  let overlay: TranslationOverlay | null = null;
  let lifecycleFrame: number | undefined;
  let discoveryFrame: number | undefined;
  let popupLifecycleObserver: MutationObserver | undefined;
  let removePopupHoverGuard: (() => void) | undefined;
  let removeOverlayHoverGuard: (() => void) | undefined;
  let pointerX = -1;
  let pointerY = -1;
  let hoverIntent = false;
  let generation = 0;

  const close = () => {
    generation++;
    const connectedAnchor = anchor?.isConnected && pointerIsOver(anchor) ? anchor : null;
    if (lifecycleFrame !== undefined) cancelAnimationFrame(lifecycleFrame);
    if (discoveryFrame !== undefined) cancelAnimationFrame(discoveryFrame);
    popupLifecycleObserver?.disconnect();
    removePopupHoverGuard?.();
    removeOverlayHoverGuard?.();
    lifecycleFrame = undefined;
    discoveryFrame = undefined;
    popupLifecycleObserver = undefined;
    removePopupHoverGuard = undefined;
    removeOverlayHoverGuard = undefined;
    overlay?.destroy();
    overlay = null;
    activePopup = null;
    // A site may recycle its popup after the pointer has already returned to
    // the trigger, so preserve a live anchor for the next visibility change.
    anchor = connectedAnchor;
    hoverIntent = Boolean(anchor);
    if (hoverIntent) startPopupDiscovery();
  };
  const waitForPopup = (target: HTMLElement) => {
    // Axiom reuses the same tooltip root for neighbouring toolbar icons.
    // A fresh pointerover on an X trigger is explicit new intent, so a root
    // dismissed for the previous icon must be eligible again.
    if (anchor === target) {
      hoverIntent = true;
      startPopupDiscovery();
      return;
    }
    close();
    rememberAnchor(target);
  };
  const show = async (match: PopupMatch) => {
    if (match.popup === activePopup && overlay) return;
    const current = generation;
    activePopup = match.popup;
    if (!overlay) overlay = new TranslationOverlay(interfaceLanguage);
    overlay.place(match);
    guardCombinedHover(match.popup, match.content, overlay.host);
    overlay.loading();
    followPopupLifecycle(match.popup);
    const indices = match.translationTargets.map((_target, index) => index);
    const revisions = indices.map(() => 0);
    const pending = new Set<number>();
    const execute = async (selected = indices, force = false) => {
      await Promise.all(
        selected.map(async (index) => {
          const revision = ++revisions[index];
          pending.add(index);
          if (current === generation) overlay?.loadingBlock(index);
          try {
            const result = await translator.translate(
              match.translationTargets[index].text,
              settings.targetLanguage,
              force
            );
            if (current === generation && revisions[index] === revision)
              overlay?.successBlock(index, result.text);
          } catch (error) {
            if (current === generation && revisions[index] === revision)
              overlay?.errorBlock(
                index,
                error instanceof Error
                  ? error.message
                  : message("translationFailed", "Could not translate"),
                () => void execute([index], true)
              );
          } finally {
            if (revisions[index] === revision) pending.delete(index);
            if (current === generation && !pending.size)
              overlay?.setReloadHandler(() => void execute(indices, true));
          }
        })
      );
    };
    // Closing the popup only detaches its UI. The Translator keeps pending work
    // for deduplication and populates the cache for the next hover.
    await execute();
  };
  function popupIsVisible(popup: HTMLElement) {
    const rect = popup.getBoundingClientRect();
    const style = getComputedStyle(popup);
    return (
      popup.isConnected &&
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }
  function followPopupLifecycle(popup: HTMLElement) {
    if (lifecycleFrame !== undefined) cancelAnimationFrame(lifecycleFrame);
    popupLifecycleObserver?.disconnect();
    popupLifecycleObserver = new MutationObserver(() => {
      if (popup === activePopup && !popupIsVisible(popup)) close();
    });
    popupLifecycleObserver.observe(popup, {
      attributes: true,
      attributeFilter: ["class", "style", "hidden"]
    });
    if (popup.parentElement) {
      popupLifecycleObserver.observe(popup.parentElement, { childList: true });
    }
    const check = () => {
      if (popup !== activePopup || !popupIsVisible(popup)) {
        close();
        return;
      }
      overlay?.align(popup);
      lifecycleFrame = requestAnimationFrame(check);
    };
    lifecycleFrame = requestAnimationFrame(check);
  }
  function guardCombinedHover(
    popup: HTMLElement,
    popupContent: HTMLElement,
    overlayHost: HTMLElement
  ) {
    removePopupHoverGuard?.();
    removeOverlayHoverGuard?.();
    const guardedSources = [popup, ...(anchor?.isConnected ? [anchor] : [])];
    const exitTargets = new Map<HTMLElement, EventTarget>();

    const movingToOverlay = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget;
      const current = event.currentTarget;
      const movingToCombinedRegion =
        related instanceof Node &&
        (overlayHost.contains(related) ||
          guardedSources.some((source) => source !== current && source.contains(related)));
      if (movingToCombinedRegion) {
        if (event.target instanceof Node && (event.currentTarget as Node).contains(event.target)) {
          exitTargets.set(event.currentTarget as HTMLElement, event.target);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const leavingOverlay = (event: MouseEvent | PointerEvent) => {
      const related = event.relatedTarget;
      if (
        related instanceof Node &&
        (overlayHost.contains(related) || guardedSources.some((source) => source.contains(related)))
      ) {
        return;
      }
      const relatedTarget = related instanceof EventTarget ? related : document.body;
      const currentAnchor = anchor?.isConnected ? anchor : recoverAnchor();
      const exitSources = [
        ...new Set([...guardedSources, ...(currentAnchor ? [currentAnchor] : [])])
      ];
      exitSources.forEach((source) => {
        const exitTarget = exitTargets.get(source) ?? (source === popup ? popupContent : source);
        exitTarget.dispatchEvent(
          new PointerEvent("pointerout", { bubbles: true, cancelable: true, relatedTarget })
        );
        source.dispatchEvent(
          new PointerEvent("pointerleave", { bubbles: false, cancelable: false, relatedTarget })
        );
        exitTarget.dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true, cancelable: true, relatedTarget })
        );
        source.dispatchEvent(
          new MouseEvent("mouseleave", { bubbles: false, cancelable: false, relatedTarget })
        );
      });
      hoverIntent = false;
      anchor = null;
      anchorUrl = undefined;
      anchorCenter = undefined;
      close();
    };

    guardedSources.forEach((source) => {
      source.addEventListener("mouseout", movingToOverlay, true);
      source.addEventListener("mouseleave", movingToOverlay, true);
      source.addEventListener("pointerout", movingToOverlay, true);
      source.addEventListener("pointerleave", movingToOverlay, true);
    });
    overlayHost.addEventListener("pointerout", leavingOverlay);
    removePopupHoverGuard = () => {
      guardedSources.forEach((source) => {
        source.removeEventListener("mouseout", movingToOverlay, true);
        source.removeEventListener("mouseleave", movingToOverlay, true);
        source.removeEventListener("pointerout", movingToOverlay, true);
        source.removeEventListener("pointerleave", movingToOverlay, true);
      });
    };
    removeOverlayHoverGuard = () => overlayHost.removeEventListener("pointerout", leavingOverlay);
  }
  function rememberAnchor(target: HTMLElement): void {
    anchor = target;
    hoverIntent = true;
    const link =
      target instanceof HTMLAnchorElement
        ? target
        : target.querySelector<HTMLAnchorElement>("a[href]");
    anchorUrl = link?.href;
    const rect = target.getBoundingClientRect();
    anchorCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  function recoverAnchor(): HTMLElement | null {
    if (!anchorUrl || !anchorCenter) return null;
    const center = anchorCenter;
    const candidates = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((link) => link.href === anchorUrl)
      .flatMap((link) => {
        const candidate = adapter?.findTwitterAnchor(link);
        return candidate?.isConnected ? [candidate] : [];
      });
    const replacement = candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (
        Math.hypot(
          leftRect.left + leftRect.width / 2 - center.x,
          leftRect.top + leftRect.height / 2 - center.y
        ) -
        Math.hypot(
          rightRect.left + rightRect.width / 2 - center.x,
          rightRect.top + rightRect.height / 2 - center.y
        )
      );
    })[0];
    if (replacement) rememberAnchor(replacement);
    return replacement ?? null;
  }
  function pointerIsOver(element: HTMLElement): boolean {
    const pointed = document.elementFromPoint(pointerX, pointerY);
    return pointed instanceof Node && element.contains(pointed);
  }
  function pointerIsOverPendingPopup(): boolean {
    const pointed = document.elementFromPoint(pointerX, pointerY);
    return (
      (pointed instanceof Element && adapter?.isPopupTarget(pointed) === true) ||
      adapter?.isPointInsidePopup(pointerX, pointerY) === true
    );
  }
  function startPopupDiscovery(): void {
    if (discoveryFrame !== undefined) cancelAnimationFrame(discoveryFrame);
    const discover = () => {
      discoveryFrame = undefined;
      if (anchor && !anchor.isConnected) anchor = recoverAnchor();
      if (
        !anchor?.isConnected ||
        (!pointerIsOver(anchor) && !pointerIsOverPendingPopup()) ||
        activePopup
      )
        return;
      scan();
      if (anchor && !activePopup) {
        discoveryFrame = requestAnimationFrame(discover);
      }
    };
    discoveryFrame = requestAnimationFrame(discover);
  }
  const scan = () => {
    if (anchor && !anchor.isConnected) anchor = recoverAnchor();
    if (!anchor && pointerX >= 0 && pointerY >= 0) {
      const pointed = document.elementFromPoint(pointerX, pointerY);
      if (pointed instanceof Element) {
        const recovered = adapter.findTwitterAnchor(pointed);
        if (recovered) rememberAnchor(recovered);
      }
    }
    if (
      hoverIntent &&
      !anchor &&
      !activePopup &&
      !adapter.hasVisiblePopup() &&
      !pointerIsOverPendingPopup()
    ) {
      hoverIntent = false;
      return;
    }
    // Popup contents can mutate while loading. Keep the overlay pinned to the
    // selected lifecycle root instead of chasing its changing descendants.
    if (activePopup && overlay) {
      if (popupIsVisible(activePopup)) return;
      close();
      return;
    }
    const canUseOpenPopup = hoverIntent || adapter.detectsPopupIndependently;
    const match =
      (anchor ? adapter.findPopup(anchor) : null) ??
      (canUseOpenPopup ? adapter.findOpenPopup() : null);
    if (match) {
      void show(match);
    } else if (activePopup && !activePopup.isConnected) {
      close();
    }
  };
  const stop = adapter.observe(scan);
  document.addEventListener(
    "pointermove",
    (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    },
    true
  );
  document.addEventListener(
    "pointerover",
    (event) => {
      const target = event.target;
      if (target instanceof Element) {
        if (activePopup?.contains(target) || target.closest('[data-tweet-translator="overlay"]')) {
          return;
        }
        if (anchor && adapter.isPopupTarget(target)) {
          startPopupDiscovery();
          return;
        }
        const found = adapter.findTwitterAnchor(target);
        if (found) {
          waitForPopup(found);
          scan();
          if (!activePopup) startPopupDiscovery();
        } else if (
          hoverIntent &&
          !activePopup &&
          !adapter.isPopupTarget(target) &&
          !anchor?.contains(target) &&
          target.closest("a,button,[role='button']")
        ) {
          // Moving directly to another toolbar action cancels the old X
          // intent. Otherwise a recycled generic tooltip can be mistaken for
          // the tweet popup associated with the previous icon.
          if (discoveryFrame !== undefined) cancelAnimationFrame(discoveryFrame);
          discoveryFrame = undefined;
          anchor = null;
          anchorUrl = undefined;
          anchorCenter = undefined;
          hoverIntent = false;
        }
      }
    },
    true
  );
  const handlePendingPointerExit = (event: MouseEvent | PointerEvent) => {
    if (anchor && !activePopup && adapter.isPointInsidePopup(event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startPopupDiscovery();
      return;
    }
    const related = event.relatedTarget;
    if (anchor && related instanceof Element && adapter.isPopupTarget(related)) {
      startPopupDiscovery();
      return;
    }
    if (anchor && !anchor.isConnected) anchor = recoverAnchor();
    if (hoverIntent && !activePopup && adapter.hasVisiblePopup()) {
      startPopupDiscovery();
      return;
    }
    if (
      hoverIntent &&
      !activePopup &&
      !pointerIsOverPendingPopup() &&
      (!anchor || !pointerIsOver(anchor))
    ) {
      if (discoveryFrame !== undefined) cancelAnimationFrame(discoveryFrame);
      discoveryFrame = undefined;
      anchor = null;
      anchorUrl = undefined;
      anchorCenter = undefined;
      hoverIntent = false;
    }
  };
  document.addEventListener("pointerout", handlePendingPointerExit, true);
  document.addEventListener("mouseout", handlePendingPointerExit, true);
  addEventListener(
    "pagehide",
    () => {
      stop();
      close();
    },
    { once: true }
  );
})();
