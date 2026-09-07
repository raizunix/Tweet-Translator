import { withDeadline } from "../translation/async";
import { TranslationError } from "../translation/errors";
import { requestScheduler } from "./request-scheduler";

export function retryAfterMs(value: string | null, now = Date.now()): number {
  if (!value) return 60_000;
  const seconds = Number(value);
  const duration = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(duration) ? Math.max(1000, duration) : 60_000;
}

export function httpError(status: number, retryAfter?: number): TranslationError {
  const code =
    status === 429
      ? "rate-limit"
      : status === 401 || status === 403
        ? "auth"
        : status === 400 || status === 404 || status === 422
          ? "unsupported"
          : status >= 500
            ? "network"
            : "invalid-request";
  return new TranslationError(`Translation service returned ${status}`, code, retryAfter);
}

export async function fetchAndRead<T>(
  input: string | URL,
  init: RequestInit & { signal: AbortSignal },
  timeoutMs: number,
  read: (response: Response) => Promise<T>
): Promise<T> {
  const key = new URL(input).origin;
  return requestScheduler.schedule(key, init.signal, () =>
    withDeadline(init.signal, timeoutMs, async (signal) => {
      const response = await fetch(input, { ...init, signal, credentials: "omit" });
      if (!response.ok) {
        const retryAfter =
          response.status === 429
            ? retryAfterMs(response.headers?.get("Retry-After") ?? null)
            : undefined;
        if (retryAfter !== undefined) requestScheduler.defer(key, retryAfter);
        await response.body?.cancel().catch(() => undefined);
        throw httpError(response.status, retryAfter);
      }
      // Keep both deadline and parent cancellation active through body consumption.
      return read(response);
    })
  );
}

export const fetchJson = <T>(
  input: string | URL,
  init: RequestInit & { signal: AbortSignal },
  timeoutMs = 5000
): Promise<T> =>
  fetchAndRead(input, init, timeoutMs, async (response) => {
    try {
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new TranslationError("Invalid JSON response", "invalid-result");
      throw error;
    }
  });
