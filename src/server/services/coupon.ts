import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";

const normalize = (code: string) => code.trim().toUpperCase();

/** Returns the coupon if it's currently usable (active, not expired, uses remaining), else null. */
export async function findValidCoupon(code: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: normalize(code) } });
  if (!coupon || !coupon.active) return null;
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return null;
  if (coupon.uses >= coupon.maxUses) return null;
  return coupon;
}

export interface CreateCouponInput {
  code: string;
  percentOff?: number;
  amountOffUzs?: number;
  maxUses?: number;
  expiresAt?: string;
}

/** Admin-only: create a promo code. Exactly one of percentOff / amountOffUzs. */
export async function createCoupon(admin: User, input: CreateCouponInput) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const hasPct = input.percentOff != null;
  const hasAmt = input.amountOffUzs != null;
  if (hasPct === hasAmt) throw Errors.validation({ discount: "Set either percentOff or amountOffUzs" });
  if (hasPct && (input.percentOff! < 1 || input.percentOff! > 100)) {
    throw Errors.validation({ percentOff: "1–100" });
  }
  const code = normalize(input.code);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw Errors.validation({ code: "3–24 letters/digits" });
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw Errors.conflict("Code already exists");

  const coupon = await prisma.coupon.create({
    data: {
      code,
      percentOff: hasPct ? input.percentOff : null,
      amountOffUzs: hasAmt ? input.amountOffUzs : null,
      maxUses: input.maxUses && input.maxUses > 0 ? input.maxUses : 100,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
  await audit({ actorId: admin.id, action: "coupon.create", entity: "Coupon", entityId: coupon.id });
  return coupon;
}

export function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
