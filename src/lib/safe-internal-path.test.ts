import { describe, it, expect } from "vitest";
import { safeInternalPath } from "./utils";

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);
const BS = String.fromCharCode(92);

describe("safeInternalPath", () => {
  it("accepts same-origin relative paths (with query)", () => {
    expect(safeInternalPath("/uz/gigs/x")).toBe("/uz/gigs/x");
    expect(safeInternalPath("/uz/gigs/x?tier=PREMIUM")).toBe("/uz/gigs/x?tier=PREMIUM");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("http://evil.com")).toBeNull();
  });

  it("rejects control-char open-redirect bypasses (browser strips tab/LF/CR before parsing)", () => {
    // "/\t/evil.com" would collapse to "//evil.com" at navigation time.
    expect(safeInternalPath(`/${TAB}/evil.com`)).toBeNull();
    expect(safeInternalPath(`/${LF}/evil.com`)).toBeNull();
    expect(safeInternalPath(`/${CR}/evil.com`)).toBeNull();
    expect(safeInternalPath(`/${NUL}/evil.com`)).toBeNull();
  });

  it("rejects backslashes and non-path junk", () => {
    expect(safeInternalPath(`/a${BS}evil.com`)).toBeNull();
    expect(safeInternalPath("relative/no-slash")).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath("/" + "a".repeat(600))).toBeNull();
  });

  it("does not decode percent-encoding (an encoded slash stays a harmless path char)", () => {
    expect(safeInternalPath("/%2F%2Fevil")).toBe("/%2F%2Fevil");
  });
});
