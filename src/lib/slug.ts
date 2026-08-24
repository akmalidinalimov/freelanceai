import "server-only";
import crypto from "crypto";

/** URL-friendly slug from a title (keeps unicode letters; trims to 60 chars). */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gig"
  );
}

/** A slug with a short random suffix — collision-safe without a uniqueness loop. */
export function uniqueSlug(title: string): string {
  return `${slugify(title)}-${crypto.randomBytes(3).toString("hex")}`;
}
