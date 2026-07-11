import { HeaderSkeleton, Skeleton } from "@/components/skeletons";

// Cascades to all /admin/* consoles that lack their own loading state — most are tables.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <HeaderSkeleton />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}
