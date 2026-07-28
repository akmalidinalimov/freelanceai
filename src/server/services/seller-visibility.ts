import type { Prisma } from "@prisma/client";

/**
 * Seller approval gate (2026-07-09).
 *
 * A seller and their gigs are only visible on PUBLIC surfaces once an admin has
 * APPROVED them. These fragments are the single source of truth for that rule —
 * every public query (marketplace, search, categories, creator profiles, gig
 * detail, sitemap) must compose one of them so the gate can never drift.
 *
 * Admin and self-serve queries deliberately do NOT use these (an admin sees all
 * sellers; a seller sees their own unapproved profile/gigs in their dashboard).
 */

/** Where-fragment on a `User` row: a publicly visible, approved seller. */
export const PUBLIC_SELLER_USER = {
  isSeller: true,
  status: "ACTIVE",
  sellerProfile: { is: { approvalStatus: "APPROVED" } },
} satisfies Prisma.UserWhereInput;

/** Where-fragment on a `SellerProfile` row: an approved seller. */
export const PUBLIC_SELLER_PROFILE = {
  approvalStatus: "APPROVED",
  user: { is: { isSeller: true, status: "ACTIVE" } },
} satisfies Prisma.SellerProfileWhereInput;

/** Where-fragment on a `Gig` row: the gig's seller is an approved, active seller. */
export const PUBLIC_GIG_SELLER = {
  seller: { is: { isSeller: true, status: "ACTIVE", sellerProfile: { is: { approvalStatus: "APPROVED" } } } },
} satisfies Prisma.GigWhereInput;
