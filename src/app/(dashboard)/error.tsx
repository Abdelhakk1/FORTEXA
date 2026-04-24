"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto mt-16 max-w-xl border border-red-200 bg-red-50 p-6 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">This page could not load</h2>
          <p className="mt-2 text-sm opacity-85">
            Fortexa hit a server-side error while loading this protected view.
            Retry once; if it persists, check the deployment logs with digest{" "}
            <span className="font-mono">{error.digest ?? "unavailable"}</span>.
          </p>
          <Button
            type="button"
            onClick={reset}
            className="mt-5 border-0 bg-red-700 text-white hover:bg-red-800"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    </Card>
  );
}
