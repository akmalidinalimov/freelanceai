import { HeaderSkeleton, GigGridSkeleton } from "@/components/skeletons";

// Covers /browse and /browse/[spec] — both render a gig grid.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <HeaderSkeleton />
      <GigGridSkeleton count={9} />
    </div>
  );
}
