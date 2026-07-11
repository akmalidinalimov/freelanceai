import { Skeleton } from "@/components/skeletons";

// A conversation thread is a two-pane chat (sidebar rail + messages), unlike the inbox list
// that messages/loading.tsx renders — so it needs its own skeleton to avoid a layout jump.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation rail */}
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        {/* Active thread */}
        <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={i % 2 ? "flex justify-end" : "flex justify-start"}>
                <Skeleton className="h-12 w-2/3 rounded-2xl" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-4 h-11 w-full rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}
