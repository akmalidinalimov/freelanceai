import { Skeleton } from "@/components/skeletons";

// Streaming boundary: this route is a Server Component doing DB work, so without one the
// whole navigation blocks on a blank screen. Skeleton mirrors the real layout to avoid a jump.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="aspect-video w-full rounded-[var(--radius-lg)]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}
