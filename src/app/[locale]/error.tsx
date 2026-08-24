"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Segment error boundary. Kept i18n-free on purpose — if the failure is in the layout,
 * the next-intl provider may not be mounted, so we use plain English to avoid an error loop.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The structured logger runs server-side; here we just surface it to the browser console.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-[hsl(var(--muted-foreground))]">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
