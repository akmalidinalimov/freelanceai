"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";

async function post(body: Record<string, unknown>): Promise<boolean> {
  const r = await fetch("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()).ok;
}

export function CreateCollection() {
  const t = useTranslations("Collections");
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    if (await post({ action: "create", name: name.trim() })) {
      setName("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("newPh")}
        aria-label={t("newPh")}
        maxLength={60}
        className="h-9 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm"
      />
      <Button type="submit" size="sm" disabled={busy || !name.trim()}>
        {t("create")}
      </Button>
    </form>
  );
}

export function DeleteCollection({ id }: { id: string }) {
  const t = useTranslations("Collections");
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!(await confirm({ title: t("confirmDelete"), danger: true }))) return;
    setBusy(true);
    if (await post({ action: "delete", id })) router.refresh();
    setBusy(false);
  }
  return (
    <button onClick={del} disabled={busy} className="text-xs text-[hsl(var(--danger))] hover:underline">
      {t("delete")}
    </button>
  );
}

export function CollectionSelect({
  gigId,
  collections,
  current,
}: {
  gigId: string;
  collections: { id: string; name: string }[];
  current: string | null;
}) {
  const t = useTranslations("Collections");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    setBusy(true);
    const val = e.target.value || null;
    if (await post({ action: "assign", gigId, collectionId: val })) router.refresh();
    setBusy(false);
  }

  return (
    <select
      value={current ?? ""}
      onChange={change}
      disabled={busy}
      aria-label={t("assign")}
      className="mt-1 h-8 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-2 text-xs"
    >
      <option value="">{t("uncategorized")}</option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
