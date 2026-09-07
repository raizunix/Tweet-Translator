import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestScheduler } from "../../src/background/request-scheduler";
import { fetchAndRead, retryAfterMs } from "../../src/background/http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const signal = () => new AbortController().signal;

describe("network scheduling and cancellation", () => {
  it("limits both total concurrency and per-service concurrency", async () => {
    const queue = new RequestScheduler(2, 1, 0);
    const releases: Array<() => void> = [];
    const operation = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    const tasks = [
      queue.schedule("a", signal(), operation),
      queue.schedule("a", signal(), operation),
      queue.schedule("b", signal(), operation)
    ];
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(2));
    releases[0]();
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(3));
    releases[1]();
    releases[2]();
    await Promise.all(tasks);
  });

  it("removes aborted queued work without starting its fetch", async () => {
    const queue = new RequestScheduler(1, 1, 0);
    let release!: () => void;
    const first = queue.schedule(
      "a",
      signal(),
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const controller = new AbortController();
    const fetch = vi.fn();
    const assertion = expect(queue.schedule("b", controller.signal, fetch)).rejects.toMatchObject({
      name: "AbortError"
    });
    controller.abort();
    await assertion;
    release();
    await first;
    expect(fetch).not.toHaveBeenCalled();
  });

  it("spaces requests and honours cooldown across callers", async () => {
    vi.useFakeTimers();
    const queue = new RequestScheduler(2, 2, 250);
    const operation = vi.fn(async () => "ok");
    await queue.schedule("a", signal(), operation);
    const waiting = queue.schedule("a", signal(), operation);
    const rejected = expect(waiting).rejects.toMatchObject({ code: "rate-limit" });
    queue.defer("a", 2000);
    await rejected;
    await expect(queue.schedule("a", signal(), operation)).rejects.toMatchObject({
      retryAfterMs: 2000
    });
    await vi.advanceTimersByTimeAsync(2000);
    await queue.schedule("a", signal(), operation);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it.each(["abort", "deadline"])("keeps %s effective after HTTP headers arrived", async (mode) => {
    vi.useFakeTimers();
    let fetchSignal!: AbortSignal;
    let bodyStarted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        fetchSignal = init.signal;
        return {
          ok: true,
          status: 200,
          json: () => {
            bodyStarted = true;
            return new Promise(() => undefined);
          }
        };
      })
    );
    const controller = new AbortController();
    const request = fetchAndRead(
      "https://" + mode + ".example/",
      { signal: controller.signal },
      100,
      (response) => response.json()
    );
    const assertion = expect(request).rejects.toMatchObject(
      mode === "abort" ? { name: "AbortError" } : { code: "timeout" }
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(bodyStarted).toBe(true);
    if (mode === "abort") controller.abort();
    else await vi.advanceTimersByTimeAsync(101);
    await assertion;
    expect(fetchSignal.aborted).toBe(true);
  });

  it("parses both Retry-After forms", () => {
    expect(retryAfterMs("10", 0)).toBe(10000);
    expect(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 0)).toBe(60000);
    expect(retryAfterMs("invalid", 0)).toBe(60000);
  });
});
