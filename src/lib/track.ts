"use client";

/**
 * Fire-and-forget client funnel event (order/contact CTA clicks → /api/events).
 * keepalive lets the beacon survive the navigation the click usually triggers.
 * Never throws, never blocks the UI.
 */
export function track(type: "order_cta_click" | "contact_cta_click", entityId?: string): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...(entityId ? { entityId } : {}) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort
  }
}
