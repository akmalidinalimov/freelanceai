import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";

export function listCategoriesWithCounts() {
  return prisma.category.findMany({
    orderBy: { slug: "asc" },
    include: { _count: { select: { gigs: true } } },
  });
}

export interface CategoryInput {
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

export async function createCategory(admin: User, input: CategoryInput) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw Errors.validation({ slug: "2–40 lowercase letters/digits/hyphens" });
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw Errors.conflict("Slug already exists");
  const names = {
    nameUz: input.nameUz.trim(),
    nameRu: input.nameRu.trim(),
    nameEn: input.nameEn.trim(),
  };
  if (!names.nameUz || !names.nameRu || !names.nameEn) {
    throw Errors.validation({ name: "All three names are required" });
  }
  const cat = await prisma.category.create({ data: { slug, ...names } });
  await audit({ actorId: admin.id, action: "category.create", entity: "Category", entityId: cat.id });
  return cat;
}

export async function deleteCategory(admin: User, id: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const count = await prisma.gig.count({ where: { categoryId: id } });
  if (count > 0) throw Errors.conflict("Category has gigs — reassign them first");
  await prisma.category.delete({ where: { id } });
  await audit({ actorId: admin.id, action: "category.delete", entity: "Category", entityId: id });
}
