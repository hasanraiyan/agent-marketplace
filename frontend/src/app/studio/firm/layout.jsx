"use client";

import { FirmProvider, useFirm } from "@/components/studio/firm-context";
import { FirmNav } from "@/components/studio/firm-nav";
import { Skeleton } from "@/components/ui/skeleton";

function FirmNavGate() {
  const { firm, loading } = useFirm();
  if (loading) return <Skeleton className="h-10 w-80 max-w-full rounded-full" />;
  if (!firm) return null;
  return <FirmNav />;
}

/**
 * Shell for the creator's firm office. Loads the firm once and shows the
 * Overview · Projects · Team · Clients sub-nav on every screen below it.
 */
export default function FirmLayout({ children }) {
  return (
    <FirmProvider>
      <div className="@container/main min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <FirmNavGate />
          {children}
        </div>
      </div>
    </FirmProvider>
  );
}
