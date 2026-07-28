export const X_LINK_SELECTOR =
  'a[href*="twitter.com/"][href*="/status/"],a[href*="x.com/"][href*="/status/"]';
export const POPUP_SELECTOR = [
  '[role="tooltip"]',
  '[role="dialog"]',
  "[data-radix-popper-content-wrapper]",
  '[data-testid="tweet"]',
  'article[data-testid="tweet"]',
  '[class*="react-tweet" i]'
].join(",");
