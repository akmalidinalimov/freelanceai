"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Admin: mark a seller's payout request as paid. */
export function FulfillPayoutButton({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/payout-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else {
      setError(j.error?.message ?? "Error");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="accent" onClick={go} disabled={busy}>
        Mark paid
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
