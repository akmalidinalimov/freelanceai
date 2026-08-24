"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import { FormSection, fieldClass } from "@/components/ui/form-section";
import { SKILLS, NICHES, specLabel } from "@/lib/specializations";

// Common AI tools as suggestions for the free-form "tools" chips (not a controlled vocabulary).
const AI_TOOL_SUGGESTIONS = [
  "Midjourney", "ChatGPT", "Runway", "Kling", "Sora", "ElevenLabs", "Higgsfield",
  "Stable Diffusion", "DALL·E", "CapCut", "Photoshop", "After Effects", "Suno",
];

/**
 * Seller profile editor, grouped into white section cards. The page ground is Sandstone;
 * fields on bare background with transparent fills were hard to read on a phone, so each
 * group is a card and every input has a white fill.
 */
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
    experienceYears: number | null;
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
  const [experience, setExperience] = useState<number | null>(initial.experienceYears);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSpec = (key: string) =>
    setSpecs((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

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
        experienceYears: experience,
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
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          on
            ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
        }`}
      >
        {specLabel(key, locale)}
      </button>
    );
  };

  const expBands = [
    [0, t("exp.0")],
    [1, t("exp.1")],
    [3, t("exp.3")],
    [5, t("exp.5")],
  ] as const;

  return (
    <div className="space-y-4">
      {/* 1 — who you are, in the buyer's words */}
      <FormSection title={t("secAbout")} desc={t("secAboutHint")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("headline")}</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className={fieldClass}
              maxLength={120}
              placeholder={t("headlinePh")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("about")}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${fieldClass} min-h-28`}
              maxLength={600}
              placeholder={t("aboutPh")}
            />
          </label>
        </div>
      </FormSection>

      {/* 2 — capability: skills, tools, experience */}
      <FormSection title={t("secSkills")} desc={t("secSkillsHint")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("skills")}</span>
            <TagInput value={skills} onChange={setSkills} suggestions={skillSuggestions} placeholder={t("tagHint")} ariaLabel={t("skills")} max={20} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("tools")}</span>
            <TagInput value={aiTools} onChange={setAiTools} suggestions={AI_TOOL_SUGGESTIONS} placeholder={t("tagHint")} ariaLabel={t("tools")} max={20} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("experience")}</span>
            <div className="flex flex-wrap gap-2">
              {expBands.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={experience === v}
                  onClick={() => setExperience(experience === v ? null : v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    experience === v
                      ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      {/* 3 — where buyers can see more work */}
      <FormSection title={t("secLinks")} desc={t("secLinksHint")} badge={t("optionalBadge")}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("instagram")}</span>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder={t("instagramHint")}
            className={fieldClass}
            inputMode="text"
            autoCapitalize="none"
          />
        </label>
      </FormSection>

      {/* 4 — the searchable taxonomy */}
      <FormSection title={t("specializations")} desc={t("specializationsHint")} badge={t("optionalBadge")}>
        <div className="flex flex-col gap-4">
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
      </FormSection>

      {/* Sticky save: on a long phone form the button must always be reachable. */}
      <div className="sticky bottom-16 z-20 -mx-4 flex items-center gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/92 px-4 py-3 backdrop-blur md:bottom-0">
        <Button onClick={save} disabled={busy} size="lg">
          {busy ? "…" : t("save")}
        </Button>
        {saved && <span className="text-sm font-medium text-[hsl(var(--success))]">{t("saved")}</span>}
      </div>
    </div>
  );
}
