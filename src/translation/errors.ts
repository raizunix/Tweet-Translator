export type TranslationErrorCode =
  | "network"
  | "timeout"
  | "rate-limit"
  | "auth"
  | "unsupported"
  | "invalid-result"
  | "invalid-request";

export class TranslationError extends Error {
  constructor(
    message: string,
    readonly code: TranslationErrorCode,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function canRetry(error: unknown): boolean {
  return !(error instanceof TranslationError) || ["network", "timeout"].includes(error.code);
}

export function raceError(errors: unknown[]): unknown {
  return (
    errors.find((error) => !isAbortError(error) && canRetry(error)) ??
    errors.find((error) => !isAbortError(error)) ??
    errors[0]
  );
}
