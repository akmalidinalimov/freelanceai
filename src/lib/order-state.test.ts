import { describe, it, expect } from "vitest";
import { canTransition } from "./order-state";

describe("order state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("IN_PROGRESS", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED")).toBe(true);
    expect(canTransition("DELIVERED", "REVISION")).toBe(true);
    expect(canTransition("REVISION", "DELIVERED")).toBe(true);
  });

  it("allows cancellation only while active", () => {
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransition("REVISION", "CANCELLED")).toBe(true);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CANCELLED", "IN_PROGRESS")).toBe(false);
  });

  it("treats terminal states as dead ends", () => {
    expect(canTransition("COMPLETED", "REVISION")).toBe(false);
    expect(canTransition("CANCELLED", "DELIVERED")).toBe(false);
    expect(canTransition("DISPUTED", "COMPLETED")).toBe(false);
  });
});
