import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";
import { hasIntactProtectedMarkers, normalizeComparableText } from "../result-validation";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetAfterMs?: number;
  now?: () => number;
  providerTimeoutMs?: number;
}

type State = { failures: number; openUntil: number };

const HEDGE_DELAYS_MS: Record<string, number> = {
  proxy: 0,
  "google-free": 0,
  bing: 120,
  tartu: 240,
  mymemory: 360,
  libretranslate: 650,
  lingva: 800,
  apertium: 950
};

export class RacingTranslationProvider implements TranslationProvider {
  readonly id: string;
  private readonly states = new Map<TranslationProvider, State>();
  private readonly failureThreshold: number;
  private readonly resetAfterMs: number;
  private readonly now: () => number;
  private readonly providerTimeoutMs: number;

  constructor(
    private readonly providers: readonly TranslationProvider[],
    options: CircuitBreakerOptions = {}
  ) {
    if (!providers.length) throw new Error("At least one translation provider is required");
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetAfterMs = options.resetAfterMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.providerTimeoutMs = options.providerTimeoutMs ?? 8_000;
    this.id = providers.map((provider, index) => provider.id ?? `provider-${index}`).join("|");
  }

  async translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    let available = this.providers.filter(
      (provider) => this.stateFor(provider).openUntil <= this.now()
    );
    let recoveryProbe = false;
    if (!available.length) {
      recoveryProbe = true;
      available = [
        [...this.providers].sort(
          (left, right) => this.stateFor(left).openUntil - this.stateFor(right).openUntil
        )[0]
      ];
    }

    const controllers = available.map(() => new AbortController());
    const abortAll = () => controllers.forEach((controller) => controller.abort());
    signal.addEventListener("abort", abortAll, { once: true });
    try {
      const winner = await Promise.any(
        available.map(async (provider, index) => {
          const state = this.stateFor(provider);
          let providerTimedOut = false;
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await waitForHedge(
              recoveryProbe ? 0 : (HEDGE_DELAYS_MS[provider.id ?? ""] ?? 0),
              controllers[index].signal
            );
            if (controllers[index].signal.aborted) throw new DOMException("Aborted", "AbortError");
            timer = setTimeout(() => {
              providerTimedOut = true;
              controllers[index].abort();
            }, this.providerTimeoutMs);
            const result = await provider.translate(request, controllers[index].signal);
            if (!isUsefulTranslation(request, result)) {
              throw new Error(`${provider.id ?? "Translation provider"} returned the source text`);
            }
            state.failures = 0;
            state.openUntil = 0;
            return { result, index };
          } catch (error) {
            if (providerTimedOut || !isAbortError(error)) {
              state.failures++;
              if (state.failures >= this.failureThreshold) {
                const exponent = Math.min(3, state.failures - this.failureThreshold);
                state.openUntil = this.now() + this.resetAfterMs * 2 ** exponent;
              }
            }
            if (providerTimedOut) throw new Error(`${provider.id ?? "Provider"} timed out`);
            throw error;
          } finally {
            if (timer !== undefined) clearTimeout(timer);
          }
        })
      );
      controllers.forEach((controller, index) => {
        if (index !== winner.index) controller.abort();
      });
      return winner.result;
    } catch (error) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (error instanceof AggregateError) {
        throw error.errors.find((item) => !isAbortError(item)) ?? error;
      }
      throw error;
    } finally {
      signal.removeEventListener("abort", abortAll);
    }
  }

  private stateFor(provider: TranslationProvider): State {
    let state = this.states.get(provider);
    if (!state) {
      state = { failures: 0, openUntil: 0 };
      this.states.set(provider, state);
    }
    return state;
  }
}

function waitForHedge(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function isUsefulTranslation(request: TranslationRequest, result: TranslationResult): boolean {
  if (!hasIntactProtectedMarkers(request.text, result.text)) return false;
  const translated = normalizeComparableText(result.text);
  if (!translated) return false;
  if (translated !== normalizeComparableText(request.text)) return true;
  return (
    result.detectedLanguage?.toLowerCase().split("-")[0] ===
    request.targetLanguage.toLowerCase().split("-")[0]
  );
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
