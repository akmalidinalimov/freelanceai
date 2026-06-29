import type { User, UserRole } from "@prisma/client";
import { Errors } from "./api";

/**
 * Authorization helpers. Two layers:
 *  - role checks (requireRole/requireAdmin)
 *  - relationship/ownership checks expressed as Prisma `where` builders, so that the
 *    ONLY way to fetch an owned resource is already scoped to the caller. A non-owned id
 *    then returns null → `assertFound` turns that into a 404 (we never reveal existence).
 *
 * This prevents IDOR by construction: handlers must use these builders instead of a bare
 * `findUnique({ where: { id } })`.
 */

type UserLike = Pick<User, "id" | "role" | "isSeller" | "status">;
/** Minimal principal for ownership-scoped query builders (id + role only). */
type Principal = Pick<User, "id" | "role">;

export function hasRole(user: Pick<User, "role">, ...roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "ADMIN";
}

/** Throw FORBIDDEN unless the user has one of the given roles. */
export function requireRole(user: Pick<User, "role">, ...roles: UserRole[]): void {
  if (!hasRole(user, ...roles)) {
    throw Errors.forbidden(`Requires role: ${roles.join(" or ")}`);
  }
}

export function requireAdmin(user: Pick<User, "role">): void {
  requireRole(user, "ADMIN");
}

/** Throw FORBIDDEN unless the account is active (not suspended/deleted). */
export function requireActive(user: Pick<User, "status">): void {
  if (user.status !== "ACTIVE") throw Errors.forbidden("Account is not active");
}

/** Throw FORBIDDEN unless the user is an active seller/creator (admins allowed). */
export function requireSeller(user: UserLike): void {
  requireActive(user);
  if (!user.isSeller && user.role !== "ADMIN") {
    throw Errors.forbidden("Requires a creator account");
  }
}

/** Turn a possibly-null lookup (from a scoped query) into a guaranteed value or 404. */
export function assertFound<T>(value: T | null | undefined, message = "Not found"): T {
  if (value === null || value === undefined) throw Errors.notFound(message);
  return value;
}

// ---- Ownership-scoped `where` builders (pure; unit-tested) --------------------

/** An order is visible to its buyer, its seller, or an admin. */
export function orderWhereForUser(orderId: string, user: Principal) {
  if (isAdmin(user)) return { id: orderId };
  return { id: orderId, OR: [{ buyerId: user.id }, { sellerId: user.id }] };
}

/** A gig may be edited by its owner (seller) or an admin. */
export function gigEditWhereForUser(gigId: string, user: Principal) {
  if (isAdmin(user)) return { id: gigId };
  return { id: gigId, sellerId: user.id };
}

/** A payout request is visible to its seller or an admin. */
export function payoutWhereForUser(payoutId: string, user: Principal) {
  if (isAdmin(user)) return { id: payoutId };
  return { id: payoutId, sellerId: user.id };
}

/** A conversation/message is visible only to participants of the linked order. */
export function conversationWhereForUser(conversationId: string, user: Principal) {
  if (isAdmin(user)) return { id: conversationId };
  return {
    id: conversationId,
    order: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
  };
}
