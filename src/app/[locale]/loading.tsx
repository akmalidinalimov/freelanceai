import { Skeleton, CreatorGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-10 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
        <Skeleton className="mt-2 h-28 w-full max-w-2xl rounded-[calc(var(--radius-lg)+0.5rem)]" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <CreatorGridSkeleton count={3} />
    </div>
  );
}
