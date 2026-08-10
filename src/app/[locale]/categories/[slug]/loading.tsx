import { GigGridSkeleton } from "@/components/skeletons";

// Streaming boundary: this route is a Server Component doing DB work, so without one the
// whole navigation blocks on a blank screen. Skeleton mirrors the real layout to avoid a jump.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <GigGridSkeleton count={9} />
    </div>
  );
}
