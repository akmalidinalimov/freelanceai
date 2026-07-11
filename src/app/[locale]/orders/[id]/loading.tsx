import { Skeleton } from "@/components/skeletons";

// Covers the order detail page (and /receipt) — timeline + work column + side panel.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="mb-6 h-12 w-full rounded-[var(--radius-lg)]" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-lg)]" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}
