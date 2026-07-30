import type { TranslationProvider, TranslationRequest, TranslationResult } from "../types";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetAfterMs?: number;
  now?: () => number;
}

type State = { failures: number; openUntil: number };

export class SequentialTranslationProvider implements TranslationProvider {
  readonly id: string;
  private readonly states = new Map<TranslationProvider, State>();
  private readonly failureThreshold: number;
  private readonly resetAfterMs: number;
  private readonly now: () => number;

  constructor(
    private readonly providers: readonly TranslationProvider[],
    options: CircuitBreakerOptions = {}
  ) {
    if (!providers.length) throw new Error("At least one translation provider is required");
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetAfterMs = options.resetAfterMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.id = providers.map((provider, index) => provider.id ?? `provider-${index}`).join(">");
  }

  async translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
    let lastError: unknown;
    for (const provider of this.providers) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const state = this.stateFor(provider);
      if (state.openUntil > this.now()) continue;
      try {
        const result = await provider.translate(request, signal);
        state.failures = 0;
        state.openUntil = 0;
        return result;
      } catch (error) {
        if (isAbortError(error)) throw error;
        lastError = error;
        state.failures++;
        if (state.failures >= this.failureThreshold) {
          state.openUntil = this.now() + this.resetAfterMs;
        }
      }
    }
    throw lastError ?? new Error("No translation provider is currently available");
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

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
