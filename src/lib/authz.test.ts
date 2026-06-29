import { describe, it, expect } from "vitest";
import {
  hasRole,
  isAdmin,
  requireRole,
  requireAdmin,
  assertFound,
  orderWhereForUser,
  gigEditWhereForUser,
  payoutWhereForUser,
  conversationWhereForUser,
} from "./authz";
import { ApiError } from "./api";

const buyer = { id: "u_buyer", role: "BUYER" as const };
const seller = { id: "u_seller", role: "SELLER" as const };
const admin = { id: "u_admin", role: "ADMIN" as const };

describe("role checks", () => {
  it("hasRole / isAdmin", () => {
    expect(hasRole(buyer, "BUYER")).toBe(true);
    expect(hasRole(buyer, "ADMIN")).toBe(false);
    expect(isAdmin(admin)).toBe(true);
  });

  it("requireRole throws FORBIDDEN when role missing", () => {
    expect(() => requireRole(buyer, "ADMIN")).toThrow(ApiError);
    try {
      requireRole(buyer, "ADMIN");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
    expect(() => requireRole(seller, "SELLER", "ADMIN")).not.toThrow();
  });

  it("requireAdmin", () => {
    expect(() => requireAdmin(buyer)).toThrow(ApiError);
    expect(() => requireAdmin(admin)).not.toThrow();
  });
});

describe("assertFound", () => {
  it("returns value when present", () => {
    expect(assertFound({ id: "x" })).toEqual({ id: "x" });
  });
  it("throws NOT_FOUND on null/undefined", () => {
    expect(() => assertFound(null)).toThrow(ApiError);
    try {
      assertFound(undefined);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
    }
  });
});

describe("ownership where-builders (IDOR scoping)", () => {
  it("scopes orders to participants for non-admins", () => {
    expect(orderWhereForUser("o1", buyer)).toEqual({
      id: "o1",
      OR: [{ buyerId: "u_buyer" }, { sellerId: "u_buyer" }],
    });
  });

  it("admins get an unscoped order lookup", () => {
    expect(orderWhereForUser("o1", admin)).toEqual({ id: "o1" });
  });

  it("scopes gig edit to the owning seller", () => {
    expect(gigEditWhereForUser("g1", seller)).toEqual({ id: "g1", sellerId: "u_seller" });
    expect(gigEditWhereForUser("g1", admin)).toEqual({ id: "g1" });
  });

  it("scopes payouts to the seller", () => {
    expect(payoutWhereForUser("p1", seller)).toEqual({ id: "p1", sellerId: "u_seller" });
  });

  it("scopes conversations to order participants", () => {
    expect(conversationWhereForUser("c1", buyer)).toEqual({
      id: "c1",
      order: { OR: [{ buyerId: "u_buyer" }, { sellerId: "u_buyer" }] },
    });
  });
});
