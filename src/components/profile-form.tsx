"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const field =
  "w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm";

export function ProfileForm({
  initial,
}: {
  initial: { headline: string; bio: string; skills: string; aiTools: string };
}) {
  const t = useTranslations("Profile");
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [skills, setSkills] = useState(initial.skills);
  const [aiTools, setAiTools] = useState(initial.aiTools);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toArr = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);

  async function save() {
    setBusy(true);
    setSaved(false);
    const r = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: headline.trim(),
        bio: bio.trim(),
        skills: toArr(skills),
        aiTools: toArr(aiTools),
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) setSaved(true);
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("headline")}</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={field} maxLength={120} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("about")}</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${field} min-h-28`} maxLength={600} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("skills")}</span>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={t("commaHint")} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("tools")}</span>
        <input value={aiTools} onChange={(e) => setAiTools(e.target.value)} placeholder={t("commaHint")} className={field} />
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "…" : t("save")}
        </Button>
        {saved && <span className="text-sm text-green-600">{t("saved")}</span>}
      </div>
    </div>
  );
}
