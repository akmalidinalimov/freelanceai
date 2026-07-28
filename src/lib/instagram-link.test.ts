import { describe, it, expect } from "vitest";
import { normalizeInstagramPost, normalizeInstagramHandle, instagramEmbedUrl } from "./instagram-link";

describe("normalizeInstagramPost", () => {
  it("accepts post / reel / tv links and canonicalizes them", () => {
    expect(normalizeInstagramPost("https://www.instagram.com/p/Cabc123DEF/")).toBe("https://www.instagram.com/p/Cabc123DEF/");
    expect(normalizeInstagramPost("instagram.com/reel/Cabc123DEF")).toBe("https://www.instagram.com/reel/Cabc123DEF/");
    expect(normalizeInstagramPost("https://instagram.com/tv/Cabc123DEF/?utm=1")).toBe("https://www.instagram.com/tv/Cabc123DEF/");
    // username-in-path form
    expect(normalizeInstagramPost("https://www.instagram.com/someuser/p/Cabc123DEF/")).toBe("https://www.instagram.com/p/Cabc123DEF/");
  });
  it("rejects non-post links and junk", () => {
    expect(normalizeInstagramPost("https://www.instagram.com/someuser/")).toBeNull(); // profile, not a post
    expect(normalizeInstagramPost("https://example.com/p/Cabc123DEF/")).toBeNull();
    expect(normalizeInstagramPost("not a url")).toBeNull();
    expect(normalizeInstagramPost("")).toBeNull();
  });
});

describe("normalizeInstagramHandle", () => {
  it("extracts a handle from a URL, @handle, or bare handle", () => {
    expect(normalizeInstagramHandle("@my.studio")).toBe("my.studio");
    expect(normalizeInstagramHandle("my.studio")).toBe("my.studio");
    expect(normalizeInstagramHandle("https://www.instagram.com/my.studio/")).toBe("my.studio");
    expect(normalizeInstagramHandle("instagram.com/my.studio?hl=en")).toBe("my.studio");
    expect(normalizeInstagramHandle("")).toBeNull();
  });
});

describe("instagramEmbedUrl", () => {
  it("appends /embed to a canonical post URL", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/p/Cabc123DEF/")).toBe("https://www.instagram.com/p/Cabc123DEF/embed");
  });
});
