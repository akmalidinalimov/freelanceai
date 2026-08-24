"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Admin approve/reject buttons for a pending-KYC user. */
export function KycRowActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "kycApprove" | "kycReject") {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if ((await r.json()).ok) router.refresh();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="accent" onClick={() => act("kycApprove")} disabled={busy}>
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => act("kycReject")} disabled={busy}>
        Reject
      </Button>
    </div>
  );
}
