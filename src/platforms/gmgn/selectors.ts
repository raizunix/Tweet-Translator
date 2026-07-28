export const X_LINK_SELECTOR =
  'a[href*="twitter.com/"][href*="/status/"],a[href*="x.com/"][href*="/status/"]';

// During loading the pointer first enters GMGN's outer tooltip wrapper, which
// does not always have an accessible role. The size and readable-text checks
// still reject unrelated small tooltips and empty skeletons.
export const POPUP_SELECTOR = '[role="tooltip"],.pi-tooltip';
