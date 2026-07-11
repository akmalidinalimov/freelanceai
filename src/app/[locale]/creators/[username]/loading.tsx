import { Skeleton, GigGridSkeleton } from "@/components/skeletons";

// Creator profile detail — avatar/header block, then their gig grid.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="mb-6 h-20 w-full rounded-[var(--radius-lg)]" />
      <GigGridSkeleton count={6} />
    </div>
  );
}
