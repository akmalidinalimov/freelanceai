import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The bug this prevents: two components on one page load each called signIn(), each triggered its
 * own /api/auth/csrf, and @auth/core mints a FRESH token and cookie per call — so the second
 * overwrote the first and whichever POST carried the losing token failed MissingCSRF. The winner
 * signed the user in while the loser painted "automatic sign-in didn't work" over a live session.
 */
const signIn = vi.fn();
const getCsrfToken = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...a: unknown[]) => signIn(...a),
  getCsrfToken: (...a: unknown[]) => getCsrfToken(...a),
}));

let signInOnce: typeof import("./signin-once").signInOnce;

beforeEach(async () => {
  vi.resetModules();
  signIn.mockReset();
  getCsrfToken.mockReset();
  getCsrfToken.mockResolvedValue("csrf");
  ({ signInOnce } = await import("./signin-once"));
});

afterEach(() => vi.unstubAllGlobals());

const deferred = () => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

describe("signInOnce", () => {
  it("performs ONE sign-in when two components ask concurrently", async () => {
    const d = deferred();
    signIn.mockReturnValue(d.promise);

    const a = signInOnce("telegram-miniapp", { initData: "x" });
    const b = signInOnce("telegram-miniapp", { initData: "x" });
    d.resolve({ ok: true });
    const [ra, rb] = await Promise.all([a, b]);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(ra).toEqual(rb);
    expect(ra.ok).toBe(true);
  });

  it("warms the csrf cookie once, not once per caller", async () => {
    // Two mints is precisely what produced MissingCSRF.
    const d = deferred();
    signIn.mockReturnValue(d.promise);
    void signInOnce("telegram-miniapp", { initData: "x" });
    void signInOnce("telegram-miniapp", { initData: "x" });
    d.resolve({ ok: true });
    await Promise.resolve();
    expect(getCsrfToken).toHaveBeenCalledTimes(1);
  });

  it("allows a real retry after the attempt settles", async () => {
    // The shared promise must NOT be cached past settlement, or one bad attempt would strand the
    // page: every later retry would replay the same stale failure.
    signIn.mockResolvedValue({ ok: true, error: "CredentialsSignin" });
    const first = await signInOnce("telegram-miniapp", { initData: "x" });
    expect(first.ok).toBe(false);

    signIn.mockResolvedValue({ ok: true });
    const second = await signInOnce("telegram-miniapp", { initData: "x" });
    expect(second.ok).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("surfaces next-auth's own error string so the UI can name the failure", async () => {
    signIn.mockResolvedValue({ ok: true, error: "MissingCSRF" });
    expect(await signInOnce("telegram-miniapp", { initData: "x" })).toEqual({
      ok: false,
      error: "MissingCSRF",
    });
  });

  it("reports a thrown request as a network failure, not a credential failure", async () => {
    signIn.mockRejectedValue(new Error("offline"));
    const res = await signInOnce("telegram-miniapp", { initData: "x" });
    expect(res).toEqual({ ok: false, network: true });
  });

  it("still attempts when warming the csrf cookie fails", async () => {
    // A failed warm-up is not fatal — signIn fetches it again. Bailing here would turn a transient
    // hiccup into an unrecoverable login screen.
    getCsrfToken.mockRejectedValue(new Error("nope"));
    signIn.mockResolvedValue({ ok: true });
    expect((await signInOnce("telegram-miniapp", { initData: "x" })).ok).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
