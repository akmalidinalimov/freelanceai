import { HeaderSkeleton, StatTilesSkeleton, Skeleton } from "@/components/skeletons";

// Cascades to all /dashboard/* pages (buyer + seller) that lack their own loading state.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <HeaderSkeleton />
      <StatTilesSkeleton count={4} />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </div>
  );
}
