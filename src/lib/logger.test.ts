import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportError } from "./logger";

/**
 * The external error-alert seam: reportError logs AND (when ERROR_ALERT_WEBHOOK is set) fires a
 * throttled, fire-and-forget webhook. No-op when the env is unset.
 */
describe("reportError external alerting", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response("ok")));

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.ERROR_ALERT_WEBHOOK;
  });

  it("does NOT call the webhook when ERROR_ALERT_WEBHOOK is unset", () => {
    delete process.env.ERROR_ALERT_WEBHOOK;
    reportError("no_webhook_case", { a: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a { text } payload to the webhook when set, and throttles repeats", () => {
    process.env.ERROR_ALERT_WEBHOOK = "https://hook.example/alert";
    const msg = `throttle_case_${Math.random().toString(36).slice(2)}`; // distinct per run
    reportError(msg, { correlationId: "abc" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hook.example/alert");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain(msg);

    // Same message within the window → throttled (no second post).
    reportError(msg, { correlationId: "def" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
