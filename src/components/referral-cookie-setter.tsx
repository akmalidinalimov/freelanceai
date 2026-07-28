"use client";

import { useEffect } from "react";

/** Stores the referrer id in a `ref` cookie so it survives until the user signs in,
 *  at which point the dashboard attributes it. Renders nothing. */
export function ReferralCookieSetter({ referrerId }: { referrerId: string }) {
  useEffect(() => {
    try {
      document.cookie = `ref=${encodeURIComponent(referrerId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, [referrerId]);
  return null;
}
