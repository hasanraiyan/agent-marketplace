"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnectors } from "../connectors-context";
import { Server, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function McpsListPage() {
  const router = useRouter();
  const { mcps, loadingMcps } = useConnectors();

  useEffect(() => {
    if (!loadingMcps && mcps.length > 0) {
      router.replace(`/dashboard/connectors/mcps/${mcps[0]._id}`);
    }
  }, [mcps, loadingMcps, router]);

  if (loadingMcps) return null;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
      <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
        <Server className="size-8" />
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
        No MCP servers configured
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
        You haven&apos;t connected any remote MCP servers yet. Add one to extend your agents&apos; capabilities with external tools and APIs.
      </p>
      <Link href="/dashboard/connectors/mcps/new" className="mt-6">
        <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
          <Plus className="mr-1.5 size-4" />
          Add Your First Server
        </Button>
      </Link>
    </div>
  );
}
