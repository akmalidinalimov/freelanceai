"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Cat {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  _count: { gigs: number };
}

/** Admin UI to create / delete catalog categories. */
export function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        router.refresh();
        return true;
      }
      setError(j.error?.message ?? "Error");
    } catch {
      setError("Error");
    } finally {
      setBusy(false);
    }
    return false;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const okDone = await post({ action: "create", slug: slug.trim(), nameUz, nameRu, nameEn });
    if (okDone) {
      setSlug("");
      setNameUz("");
      setNameRu("");
      setNameEn("");
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete category "${label}"?`)) return;
    await post({ action: "delete", id });
  }

  const field = "h-10 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm";
  return (
    <div>
      <form onSubmit={create} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
        <input
          className={`${field} w-40`}
          placeholder="slug (ai-video)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          required
        />
        <input className={`${field} w-40`} placeholder="Name (UZ)" value={nameUz} onChange={(e) => setNameUz(e.target.value)} required />
        <input className={`${field} w-40`} placeholder="Name (RU)" value={nameRu} onChange={(e) => setNameRu(e.target.value)} required />
        <input className={`${field} w-40`} placeholder="Name (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Add"}
        </Button>
        {error && <p className="w-full text-sm text-[hsl(var(--danger))]">{error}</p>}
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No categories yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
              <th className="py-2">Slug</th>
              <th>UZ</th>
              <th>RU</th>
              <th>EN</th>
              <th>Gigs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-[hsl(var(--border))]">
                <td className="py-2 font-mono">{c.slug}</td>
                <td>{c.nameUz}</td>
                <td>{c.nameRu}</td>
                <td>{c.nameEn}</td>
                <td className="tabular-nums">{c._count.gigs}</td>
                <td className="text-right">
                  <button
                    onClick={() => remove(c.id, c.nameEn)}
                    disabled={busy || c._count.gigs > 0}
                    title={c._count.gigs > 0 ? "Reassign gigs first" : "Delete"}
                    className="text-[hsl(var(--danger))] hover:underline disabled:opacity-40"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
