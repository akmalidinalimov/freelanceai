"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Category = { slug: string; name: string };
type Values = { q?: string; category?: string; min?: string; max?: string; sort?: string };

/**
 * Catalog filter toolbar. Stays a plain GET form (shareable, SSR URLs). On
 * desktop the controls are inline; on mobile category/price/sort collapse into a
 * dismissible bottom sheet — the search field stays visible so a search is one tap.
 * Controls are rendered ONCE (repositioned per breakpoint) to avoid duplicate
 * form fields.
 */
export function GigFilters({ categories, values }: { categories: Category[]; values: Values }) {
  const tg = useTranslations("Gig");
  const [open, setOpen] = useState(false);

  return (
    <form method="get" className="mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={values.q ?? ""}
            placeholder={tg("searchPh")}
            aria-label={tg("searchPh")}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="md:hidden"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {tg("filters")}
        </Button>
        <Button type="submit" className="hidden md:inline-flex">
          {tg("apply")}
        </Button>
      </div>

      {/* Backdrop (mobile only, when open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Controls: bottom sheet on mobile, inline row on desktop (single instance) */}
      <div
        className={cn(
          "flex flex-col gap-3",
          // mobile bottom sheet
          "fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 pb-6 shadow-[var(--shadow-overlay)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
          // desktop: inline, no sheet chrome
          "md:static md:z-auto md:mt-3 md:max-h-none md:translate-y-0 md:flex-row md:flex-wrap md:items-center md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
        )}
      >
        <div className="flex items-center justify-between md:hidden">
          <span className="mx-auto h-1 w-10 rounded-full bg-[hsl(var(--border))]" aria-hidden />
        </div>
        <div className="flex items-center justify-between md:hidden">
          <h3 className="font-display text-lg font-bold">{tg("filters")}</h3>
          <button type="button" onClick={() => setOpen(false)} aria-label={tg("done")}>
            <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <Select
          name="category"
          defaultValue={values.category ?? ""}
          aria-label={tg("category")}
          className="md:w-48"
        >
          <option value="">{tg("allCategories")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          name="min"
          inputMode="numeric"
          defaultValue={values.min ?? ""}
          placeholder={tg("minPrice")}
          aria-label={tg("minPrice")}
          className="md:w-28"
        />
        <Input
          name="max"
          inputMode="numeric"
          defaultValue={values.max ?? ""}
          placeholder={tg("maxPrice")}
          aria-label={tg("maxPrice")}
          className="md:w-28"
        />
        <Select name="sort" defaultValue={values.sort ?? "newest"} aria-label={tg("sort")} className="md:w-36">
          <option value="newest">{tg("sortNewest")}</option>
          <option value="popular">{tg("sortPopular")}</option>
          <option value="price_asc">{tg("sortPriceLow")}</option>
          <option value="price_desc">{tg("sortPriceHigh")}</option>
        </Select>

        <Button type="submit" className="mt-1 w-full md:hidden">
          {tg("done")}
        </Button>
      </div>
    </form>
  );
}
