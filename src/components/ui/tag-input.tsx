"use client";

import { useMemo, useRef, useState } from "react";

/**
 * Chip-style multi-tag input with taxonomy suggestions. Removes the "stare at a blank comma
 * field" problem for low-literacy sellers: they type and pick from real, localized suggestions,
 * but free entry still works. Value is a plain string[] so callers store it however they like.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  max = 8,
  ariaLabel,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const lower = value.map((v) => v.toLowerCase());
  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !lower.includes(s.toLowerCase()) && (q === "" ? true : s.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [draft, suggestions, lower]);

  function add(raw: string) {
    const tag = raw.trim().slice(0, 30);
    if (!tag || value.length >= max || lower.includes(tag.toLowerCase())) return;
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--input-border))] bg-transparent p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/[0.1] px-2.5 py-1 text-xs font-medium text-[hsl(var(--primary-ink))]"
          >
            {tag}
            <button
              type="button"
              aria-label={`remove ${tag}`}
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="text-[hsl(var(--primary-ink))]/70 hover:text-[hsl(var(--primary-ink))]"
            >
              ×
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            ref={inputRef}
            value={draft}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          />
        )}
      </div>
      {draft.trim() !== "" && matches.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                add(s);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
