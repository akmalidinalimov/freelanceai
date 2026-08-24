"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * When a shared link carries `?ref=CODE`, store it (server sets the `ref` cookie, first-touch)
 * so the referrer gets credited if this visitor signs up. Renders nothing. Mounted app-wide.
 */
export function ReferralCapture() {
  const params = useSearchParams();
  const done = useRef(false);
  useEffect(() => {
    const code = params.get("ref");
    if (!code || done.current) return;
    done.current = true;
    if (document.cookie.includes("ref=")) return; // already attributed (first-touch)
    fetch("/api/referral/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, [params]);
  return null;
}
