import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";
import { translateProtected } from "../protected-request";
import { withDeadline, waitWithSignal, abortReason } from "../async";
import { isAbortError, TranslationError, raceError } from "../errors";
import { validateOutputLanguage } from "../result-validation";
export { isAbortError } from "../errors";

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
          try {
            await waitWithSignal(
              recoveryProbe ? 0 : (HEDGE_DELAYS_MS[provider.id ?? ""] ?? 0),
              controllers[index].signal
            );
            if (controllers[index].signal.aborted) throw new DOMException("Aborted", "AbortError");
            const result = await withDeadline(
              controllers[index].signal,
              this.providerTimeoutMs,
              async (providerSignal) =>
                validateOutputLanguage(
                  request,
                  await translateProtected(
                    provider.translate.bind(provider),
                    request,
                    providerSignal
                  )
                )
            );
            state.failures = 0;
            state.openUntil = 0;
            return { result, index };
          } catch (error) {
            if (error instanceof TranslationError && error.code === "rate-limit") {
              state.openUntil = this.now() + (error.retryAfterMs ?? 60_000);
            } else if (
              !(error instanceof TranslationError && error.code === "unsupported") &&
              !isAbortError(error)
            ) {
              state.failures++;
              if (state.failures >= this.failureThreshold) {
                const exponent = Math.min(3, state.failures - this.failureThreshold);
                state.openUntil = this.now() + this.resetAfterMs * 2 ** exponent;
              }
            }
            if (error instanceof TranslationError && error.code === "timeout")
              throw new TranslationError(`${provider.id ?? "Provider"} timed out`, "timeout");
            throw error;
          }
        })
      );
      controllers.forEach((controller, index) => {
        if (index !== winner.index) controller.abort();
      });
      return winner.result;
    } catch (error) {
      if (signal.aborted) throw abortReason(signal);
      if (error instanceof AggregateError) {
        throw raceError(error.errors) ?? error;
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
