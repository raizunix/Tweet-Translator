import { TranslationError } from "./errors";

export function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
}

// A deadline must settle the caller even when an adapter ignores AbortSignal.
export function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortReason(signal));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => {
        if (signal.aborted) throw abortReason(signal);
        return operation();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function withDeadline<T>(
  parent: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (parent.aborted) throw abortReason(parent);
  const controller = new AbortController();
  const abort = () => controller.abort(abortReason(parent));
  parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new TranslationError("Translation timed out", "timeout")),
    timeoutMs
  );
  try {
    return await abortable(() => operation(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", abort);
  }
}

export function waitWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
