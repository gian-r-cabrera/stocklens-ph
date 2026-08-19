"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignalStatsTable } from "@/components/signal/signal-stats-table";
import { journalStats } from "@/lib/journal/stats";
import type { JournalEntry } from "@/lib/journal/types";
import { formatPct } from "@/lib/signal/format";

export function JournalSummary({ entries }: { entries: JournalEntry[] }) {
  const { byAction, baselineAvgReturnPct } = journalStats(entries);
  const resolvedCount = entries.filter((e) => e.status === "resolved").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Record</CardTitle>
        <CardDescription className="mt-1">
          {`Computed from your ${resolvedCount} resolved ${resolvedCount === 1 ? "call" : "calls"} only — pending calls don't count until their horizon has passed.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resolvedCount === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
            Nothing resolved yet — check back once a logged call&apos;s horizon has
            passed.
          </div>
        ) : (
          <>
            <SignalStatsTable byAction={byAction} countLabel="Calls" />
            <p className="text-xs text-muted-foreground">
              Baseline (any resolved call regardless of signal): {formatPct(baselineAvgReturnPct)}
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
