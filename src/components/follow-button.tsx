"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Follow / unfollow a creator. */
export function FollowButton({ sellerId, initialFollowing }: { sellerId: string; initialFollowing: boolean }) {
  const t = useTranslations("Profile");
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      const j = await r.json();
      if (j.ok) setFollowing(j.data.following);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant={following ? "outline" : "default"} onClick={toggle} disabled={busy}>
        {following ? t("following") : t("follow")}
      </Button>
      {error && <span className="text-xs text-[hsl(var(--danger))]" role="alert">{t("followError")}</span>}
    </span>
  );
}
