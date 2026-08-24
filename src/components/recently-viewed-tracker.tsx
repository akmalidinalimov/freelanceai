"use client";

import { useEffect } from "react";

/** Records the viewed gig id into a `rv` cookie (most-recent-first, max 10) for the
 *  "Recently viewed" row on the marketplace. Renders nothing. */
export function RecentlyViewedTracker({ gigId }: { gigId: string }) {
  useEffect(() => {
    try {
      const raw = document.cookie.split("; ").find((c) => c.startsWith("rv="))?.slice(3) ?? "";
      const ids = raw ? decodeURIComponent(raw).split(",").filter(Boolean) : [];
      const next = [gigId, ...ids.filter((x) => x !== gigId)].slice(0, 10);
      document.cookie = `rv=${encodeURIComponent(next.join(","))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, [gigId]);
  return null;
}
