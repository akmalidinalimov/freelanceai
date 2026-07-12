"use client";

import { ToasterProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm-dialog";

/**
 * App-wide UI context: toasts + confirm dialogs. Mount once, high in the tree.
 * (Platform team: please wrap the app in this inside the locale layout — see
 * UI-REQUESTS.md. Until then the useToast/useConfirm fallbacks keep call-sites safe.)
 */
export function UIProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToasterProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToasterProvider>
  );
}
