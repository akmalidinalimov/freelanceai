import { describe, it, expect } from "vitest";
import {
  hasRole,
  isAdmin,
  requireRole,
  requireAdmin,
  requireSeller,
  requireActive,
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

describe("requireActive / requireSeller", () => {
  const activeSeller = { id: "s", role: "BUYER" as const, isSeller: true, status: "ACTIVE" as const };
  const activeBuyer = { id: "b", role: "BUYER" as const, isSeller: false, status: "ACTIVE" as const };
  const suspendedSeller = { id: "x", role: "BUYER" as const, isSeller: true, status: "SUSPENDED" as const };
  const adminNonSeller = { id: "a", role: "ADMIN" as const, isSeller: false, status: "ACTIVE" as const };

  it("requireActive rejects non-active accounts", () => {
    expect(() => requireActive(suspendedSeller)).toThrow(ApiError);
    expect(() => requireActive(activeBuyer)).not.toThrow();
  });
  it("requireSeller allows an active seller and admins", () => {
    expect(() => requireSeller(activeSeller)).not.toThrow();
    expect(() => requireSeller(adminNonSeller)).not.toThrow();
  });
  it("requireSeller rejects a non-seller and a suspended seller", () => {
    expect(() => requireSeller(activeBuyer)).toThrow(ApiError);
    expect(() => requireSeller(suspendedSeller)).toThrow(ApiError);
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

  it("scopes conversations to direct or order participants", () => {
    expect(conversationWhereForUser("c1", buyer)).toEqual({
      id: "c1",
      OR: [
        { buyerId: "u_buyer" },
        { sellerId: "u_buyer" },
        { order: { buyerId: "u_buyer" } },
        { order: { sellerId: "u_buyer" } },
      ],
    });
    expect(conversationWhereForUser("c1", admin)).toEqual({ id: "c1" });
  });
});

describe("cross-tenant negative: a caller's scope never references another user", () => {
  it("no ownership builder leaks a different user's id", () => {
    const builders = [
      orderWhereForUser("o1", buyer),
      gigEditWhereForUser("g1", buyer),
      payoutWhereForUser("p1", buyer),
      conversationWhereForUser("c1", buyer),
    ];
    for (const w of builders) {
      const s = JSON.stringify(w);
      expect(s).toContain("u_buyer"); // bound to the caller
      expect(s).not.toContain("u_seller"); // never to anyone else
    }
  });
});
