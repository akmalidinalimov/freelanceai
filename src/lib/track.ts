"use client";

/**
 * Fire-and-forget client funnel event (order/contact CTA clicks → /api/events).
 * keepalive lets the beacon survive the navigation the click usually triggers.
 * Never throws, never blocks the UI.
 */
export function track(type: "order_cta_click" | "contact_cta_click" | "share", entityId?: string): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...(entityId ? { entityId } : {}) }),
      keepalive: true,
    }).catch(() => {});
    // Mirror the two CTA funnel actions to the Meta Pixel (standard events) so ad
    // campaigns can optimize. "share" is virality analytics, not an ad-optimizable
    // funnel event, so it's not mirrored. No-op when the pixel isn't loaded.
    const fbEvent = type === "order_cta_click" ? "InitiateCheckout" : type === "contact_cta_click" ? "Contact" : null;
    if (fbEvent) (window as { fbq?: (...args: unknown[]) => void }).fbq?.("track", fbEvent);
  } catch {
    // best-effort
  }
}
