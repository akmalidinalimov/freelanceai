import { describe, it, expect } from "vitest";
import { orderDueMeta, displayName, initialOf } from "./order-due";

// The translator just echoes the key + n so assertions stay locale-free.
const t = (k: string, v?: Record<string, string | number>) => (v && "n" in v ? `${k}:${v.n}` : k);
const NOW = Date.UTC(2026, 6, 5, 12, 0, 0); // 2026-07-05T12:00Z
const day = (d: number) => new Date(NOW + d * 86_400_000);

describe("orderDueMeta", () => {
  it("delivered reads differently to each side", () => {
    expect(orderDueMeta("DELIVERED", null, "seller", t, NOW)).toEqual({ text: "awaitingApproval", tone: "ok" });
    expect(orderDueMeta("DELIVERED", null, "buyer", t, NOW)).toEqual({ text: "reviewNeeded", tone: "soon" });
  });

  it("revision is a soon flag for both", () => {
    expect(orderDueMeta("REVISION", day(5), "seller", t, NOW)).toEqual({ text: "revisionRequested", tone: "soon" });
  });

  it("classifies in-progress deadlines by proximity", () => {
    expect(orderDueMeta("IN_PROGRESS", day(-1), "seller", t, NOW)).toEqual({ text: "overdue", tone: "over" });
    expect(orderDueMeta("IN_PROGRESS", day(0), "seller", t, NOW)).toEqual({ text: "dueToday", tone: "soon" });
    expect(orderDueMeta("IN_PROGRESS", day(1), "seller", t, NOW)).toEqual({ text: "dueTomorrow", tone: "soon" });
    expect(orderDueMeta("IN_PROGRESS", day(2), "seller", t, NOW)).toEqual({ text: "dueInDays:2", tone: "soon" });
    expect(orderDueMeta("IN_PROGRESS", day(6), "seller", t, NOW)).toEqual({ text: "dueInDays:6", tone: "ok" });
  });

  it("returns null when there's nothing time-relevant to say", () => {
    expect(orderDueMeta("IN_PROGRESS", null, "seller", t, NOW)).toBeNull();
    expect(orderDueMeta("COMPLETED", day(1), "buyer", t, NOW)).toBeNull();
    expect(orderDueMeta("PENDING_PAYMENT", day(1), "buyer", t, NOW)).toBeNull();
  });
});

describe("displayName / initialOf", () => {
  it("prefers firstName, then name, then @username, then fallback", () => {
    expect(displayName({ firstName: "Ali" }, "Client")).toBe("Ali");
    expect(displayName({ name: "Studio Aurora" }, "Client")).toBe("Studio Aurora");
    expect(displayName({ username: "aurora" }, "Client")).toBe("@aurora");
    expect(displayName(null, "Client")).toBe("Client");
  });

  it("derives a non-empty initial, stripping the @", () => {
    expect(initialOf("@aurora")).toBe("A");
    expect(initialOf("Ali")).toBe("A");
    expect(initialOf("")).toBe("•");
  });
});
