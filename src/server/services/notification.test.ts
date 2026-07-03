import { describe, it, expect } from "vitest";
import { notificationCategory } from "./notification";

describe("notificationCategory — mutable-preference routing", () => {
  it("routes message.* to the messages category", () => {
    expect(notificationCategory("message.new")).toBe("messages");
  });

  it("routes review.* to the reviews category", () => {
    expect(notificationCategory("review.new")).toBe("reviews");
  });

  it("routes order lifecycle events to the orders category", () => {
    for (const t of ["order.paid", "order.delivered", "order.completed", "order.tip", "order.reminder"]) {
      expect(notificationCategory(t)).toBe("orders");
    }
  });

  it("routes the new B3 events to the orders category (transactional, not muted with messages/reviews)", () => {
    for (const t of [
      "order.revision",
      "offer.new",
      "offer.accepted",
      "offer.declined",
      "gig.approved",
      "gig.rejected",
      "payout.paid",
      "cancellation.requested",
      "dispute.opened",
    ]) {
      expect(notificationCategory(t)).toBe("orders");
    }
  });

  it("does not misclassify an event that merely contains 'message'/'review' mid-string", () => {
    // Category is prefix-based ("message." / "review."), so these fall through to orders.
    expect(notificationCategory("order.review_nudge")).toBe("orders");
  });
});
