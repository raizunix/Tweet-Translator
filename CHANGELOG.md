# Changelog

## Unreleased

- Added free Bing and TartuNLP translation providers.
- Replaced simultaneous provider fan-out with a staggered hedged race that cancels losing requests.
- Added exponential provider circuit-breaker cooldown and an automatic recovery probe when every circuit is open.
- Increased translation retries, rejected unchanged results and replaced provider-specific errors with one user-friendly message.
- Preserved source line and paragraph breaks even when a translation provider collapses whitespace.
- Added unit and browser coverage for provider fallback, cancellation, Bing authentication and TartuNLP responses.

## 0.1.0

- Manifest V3 extension, Axiom DOM adapter and GMGN placeholder.
- Shadow DOM translation overlay with cache, request deduplication, timeout and retry.
- Options page, unit tests, extension load E2E skeleton, CI and documentation.
