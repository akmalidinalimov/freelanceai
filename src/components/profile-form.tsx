"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import { SKILLS, NICHES, specLabel } from "@/lib/specializations";

// Common AI tools as suggestions for the free-form "tools" chips (not a controlled vocabulary).
const AI_TOOL_SUGGESTIONS = [
  "Midjourney", "ChatGPT", "Runway", "Kling", "Sora", "ElevenLabs", "Higgsfield",
  "Stable Diffusion", "DALL·E", "CapCut", "Photoshop", "After Effects", "Suno",
];

const field =
  "w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm";

export function ProfileForm({
  initial,
}: {
  initial: {
    headline: string;
    bio: string;
    skills: string;
    aiTools: string;
    specializations: string[];
    instagramUsername: string;
  };
}) {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [skills, setSkills] = useState<string[]>(
    initial.skills.split(",").map((s) => s.trim()).filter(Boolean)
  );
  const [aiTools, setAiTools] = useState<string[]>(
    initial.aiTools.split(",").map((s) => s.trim()).filter(Boolean)
  );
  const skillSuggestions = SKILLS.map((s) => specLabel(s.key, locale));
  const [instagram, setInstagram] = useState(initial.instagramUsername);
  const [specs, setSpecs] = useState<string[]>(initial.specializations);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSpec = (key: string) =>
    setSpecs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  async function save() {
    setBusy(true);
    setSaved(false);
    const r = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: headline.trim(),
        bio: bio.trim(),
        skills: skills.slice(0, 20),
        aiTools: aiTools.slice(0, 20),
        specializations: specs,
        instagramUsername: instagram.trim().replace(/^@/, ""),
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) setSaved(true);
  }

  const chip = (key: string) => {
    const on = specs.includes(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleSpec(key)}
        aria-pressed={on}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          on
            ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
        }`}
      >
        {specLabel(key, locale)}
      </button>
    );
  };

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
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("skills")}</span>
        <TagInput value={skills} onChange={setSkills} suggestions={skillSuggestions} placeholder={t("commaHint")} ariaLabel={t("skills")} max={20} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("tools")}</span>
        <TagInput value={aiTools} onChange={setAiTools} suggestions={AI_TOOL_SUGGESTIONS} placeholder={t("commaHint")} ariaLabel={t("tools")} max={20} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("instagram")}</span>
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder={t("instagramHint")}
          className={field}
          inputMode="text"
          autoCapitalize="none"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div>
          <span className="text-sm font-medium">{t("specializations")}</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("specializationsHint")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {t("skillsGroup")}
          </span>
          <div className="flex flex-wrap gap-2">{SKILLS.map((s) => chip(s.key))}</div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {t("nichesGroup")}
          </span>
          <div className="flex flex-wrap gap-2">{NICHES.map((s) => chip(s.key))}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "…" : t("save")}
        </Button>
        {saved && <span className="text-sm text-[hsl(var(--success))]">{t("saved")}</span>}
      </div>
    </div>
  );
}
