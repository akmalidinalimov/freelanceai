import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

/**
 * L0 — the free portfolio gate. No AI, no API spend: measure each image with sharp,
 * fingerprint it, and reject what is objectively unusable before anything expensive
 * runs. Everything here is best-effort: a fetch or decode failure marks the item
 * unmeasured rather than failing the seller.
 *
 * Fingerprint = dHash (rows of 9→8 gradient comparisons, 64 bits, hex). Robust to
 * re-compression and small resizes, which is exactly what re-uploaded/stolen work
 * looks like. Same hash under two different sellers is the strongest cheap fraud
 * signal available, so it is surfaced as a blocker, not a score deduction.
 */

/** Minimums for work meant to be used in an ad or a storefront card. */
export const L0_MIN_EDGE = 800; // px on the long edge
export const L0_MIN_BYTES = 25_000; // below this, detail has been compressed away
const FETCH_TIMEOUT_MS = 8000;
const MAX_FETCH_BYTES = 15 * 1024 * 1024;

export interface ItemMetrics {
  id: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  phash: string | null;
  /** Why this item fails the technical gate (empty = passes). */
  issues: string[];
}

/** 64-bit dHash as hex. Grayscale 9×8, compare each pixel to its right neighbour. */
async function dHash(buf: Buffer): Promise<string | null> {
  try {
    const raw = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = y * 9 + x;
        bits += raw[i] > raw[i + 1] ? "1" : "0";
      }
    }
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

/** Hamming distance between two hex dHashes (null when either is missing/odd). */
export function hashDistance(a: string | null, b: string | null): number | null {
  if (!a || !b || a.length !== b.length) return null;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Fetch + measure one portfolio image, persisting what we learn. Videos are skipped
 * (sharp can't decode them; Gemini judges those natively in the AI pass). */
export async function measureItem(item: {
  id: string;
  mediaUrl: string;
  mediaType: string;
}): Promise<ItemMetrics> {
  const out: ItemMetrics = { id: item.id, width: null, height: null, bytes: null, phash: null, issues: [] };
  if (item.mediaType === "video" || !/^https?:\/\//.test(item.mediaUrl)) return out;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(item.mediaUrl, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      out.issues.push("unreachable");
      return out;
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_FETCH_BYTES) {
      out.issues.push("too_large");
      return out;
    }
    const buf = Buffer.from(ab);
    out.bytes = buf.byteLength;

    const meta = await sharp(buf).metadata();
    out.width = meta.width ?? null;
    out.height = meta.height ?? null;
    out.phash = await dHash(buf);

    const long = Math.max(out.width ?? 0, out.height ?? 0);
    if (long > 0 && long < L0_MIN_EDGE) out.issues.push(`low_resolution:${long}px`);
    if (out.bytes < L0_MIN_BYTES) out.issues.push("over_compressed");

    // Flat/blank frames: a near-zero standard deviation means an empty or solid image.
    try {
      const st = await sharp(buf).stats();
      const meanSd = st.channels.reduce((a, c) => a + c.stdev, 0) / Math.max(1, st.channels.length);
      if (meanSd < 8) out.issues.push("blank_or_flat");
    } catch {
      /* stats unavailable — not a failure */
    }

    await prisma.portfolioItem
      .update({
        where: { id: item.id },
        data: {
          width: out.width,
          height: out.height,
          bytes: out.bytes,
          phash: out.phash,
          analyzedAt: new Date(),
        },
      })
      .catch(() => {});
  } catch {
    out.issues.push("unreadable");
  }
  return out;
}

export interface L0Result {
  score: number; // 0..100
  itemsTotal: number;
  itemsPassed: number;
  blockers: string[];
  perItem: ItemMetrics[];
  /** Portfolio items that are near-identical to each other. */
  internalDuplicates: number;
}

/**
 * Run the free gate over a seller's portfolio. Returns a 0..100 technical score plus
 * hard blockers. A blocker means "do not spend AI tokens and do not queue this for the
 * admin" — e.g. the same file already exists under a different seller.
 */
export async function runL0(sellerId: string): Promise<L0Result> {
  const items = await prisma.portfolioItem.findMany({
    where: { profile: { userId: sellerId } },
    select: { id: true, mediaUrl: true, mediaType: true },
    take: 20,
  });

  const perItem: ItemMetrics[] = [];
  for (const it of items) perItem.push(await measureItem(it));

  const images = perItem.filter((m) => m.width !== null);
  const passed = images.filter((m) => m.issues.length === 0);
  const blockers: string[] = [];

  // Near-duplicates inside the portfolio: padding a thin portfolio with the same shot.
  let internalDuplicates = 0;
  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      const d = hashDistance(images[i].phash, images[j].phash);
      if (d !== null && d <= 6) internalDuplicates += 1;
    }
  }
  if (internalDuplicates > 0) blockers.push(`internal_duplicates:${internalDuplicates}`);

  // Cross-seller identical files: the same work claimed by two accounts.
  const hashes = images.map((m) => m.phash).filter((h): h is string => Boolean(h));
  if (hashes.length > 0) {
    const foreign = await prisma.portfolioItem.findMany({
      where: { phash: { in: hashes }, profile: { userId: { not: sellerId } } },
      select: { phash: true, profile: { select: { userId: true } } },
      take: 10,
    });
    if (foreign.length > 0) {
      blockers.push(`duplicate_of_other_seller:${foreign.length}`);
    }
  }

  const total = items.length;
  // Score: how much of a healthy portfolio (≥4 usable items) actually passes.
  const TARGET_ITEMS = 4;
  const coverage = Math.min(1, passed.length / TARGET_ITEMS);
  const quality = images.length > 0 ? passed.length / images.length : 0;
  const score = Math.round(100 * (0.6 * coverage + 0.4 * quality));

  if (total === 0) blockers.push("empty_portfolio");
  else if (passed.length === 0) blockers.push("no_usable_items");

  return { score, itemsTotal: total, itemsPassed: passed.length, blockers, perItem, internalDuplicates };
}
