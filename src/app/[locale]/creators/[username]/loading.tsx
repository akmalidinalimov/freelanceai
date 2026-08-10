import { Skeleton, GigGridSkeleton } from "@/components/skeletons";

// Streaming boundary: this route is a Server Component doing DB work, so without one the
// whole navigation blocks on a blank screen. Skeleton mirrors the real layout to avoid a jump.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <GigGridSkeleton count={6} />
    </div>
  );
}
