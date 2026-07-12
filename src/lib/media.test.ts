import { describe, it, expect, beforeAll } from "vitest";
import { keyFromPublicUrl, isPrivateRef, resolveStoredFile } from "./media";

beforeAll(() => {
  process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com";
  process.env.S3_BUCKET = "public-bucket";
  process.env.S3_PRIVATE_BUCKET = "private-bucket";
});

describe("stored file resolution", () => {
  it("maps a public URL to the public bucket + key", () => {
    expect(resolveStoredFile("https://cdn.example.com/gigs/abc.png")).toEqual({
      bucket: "public-bucket",
      key: "gigs/abc.png",
    });
  });

  it("maps a private ref to the private bucket + key", () => {
    expect(isPrivateRef("r2-private:deliveries/x.mp4")).toBe(true);
    expect(resolveStoredFile("r2-private:deliveries/x.mp4")).toEqual({
      bucket: "private-bucket",
      key: "deliveries/x.mp4",
    });
  });

  it("rejects a foreign URL (not one of our buckets)", () => {
    expect(isPrivateRef("https://evil.example.org/x.png")).toBe(false);
    expect(resolveStoredFile("https://evil.example.org/x.png")).toBeNull();
  });

  it("strips the public base to the object key", () => {
    expect(keyFromPublicUrl("https://cdn.example.com/portfolio/y.webp")).toBe("portfolio/y.webp");
    expect(keyFromPublicUrl("https://other.example.com/z.png")).toBeNull();
  });
});
