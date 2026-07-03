"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Admin form to create a promo code (percent OR fixed amount off). */
export function CouponForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { code: code.trim(), maxUses: Number(maxUses) || 100 };
      if (kind === "percent") body.percentOff = Number(value);
      else body.amountOffUzs = Number(value);
      const r = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        setCode("");
        setValue("");
        router.refresh();
      } else {
        setError(j.error?.message ?? "Error");
      }
    } catch {
      setError("Error");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-10 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
      <input
        className={`${field} w-40 uppercase`}
        placeholder="CODE"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
        required
      />
      <select className={field} value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")}>
        <option value="percent">% off</option>
        <option value="amount">so&apos;m off</option>
      </select>
      <input
        className={`${field} w-28`}
        inputMode="numeric"
        placeholder={kind === "percent" ? "10" : "50000"}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        required
      />
      <input
        className={`${field} w-24`}
        inputMode="numeric"
        placeholder="max uses"
        value={maxUses}
        onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
      />
      <Button type="submit" disabled={busy}>
        {busy ? "…" : "Create"}
      </Button>
      {error && <p className="w-full text-sm text-[hsl(var(--danger))]">{error}</p>}
    </form>
  );
}
