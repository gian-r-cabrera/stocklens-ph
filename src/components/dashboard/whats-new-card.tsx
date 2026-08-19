"use client";

import { ArrowRight, Check, PartyPopper, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignalBadge } from "@/components/ui/signal-badge";
import { computeNewlyResolved, computeSignalChanges } from "@/lib/digest/compute";
import type { SignalChange } from "@/lib/digest/types";
import type { JournalEntry } from "@/lib/journal/types";
import { isCorrect } from "@/lib/signal/backtest";
import { formatPct } from "@/lib/signal/format";
import { useDigestStore } from "@/lib/stores/digest-store";
import { useJournalStore } from "@/lib/stores/journal-store";
import { useWatchlistStore } from "@/lib/stores/watchlist-store";

function JournalResolvedRow({ entry }: { entry: JournalEntry }) {
  const correct = entry.actualReturnPct != null && isCorrect(entry.action, entry.actualReturnPct);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{entry.ticker}</span>
      <SignalBadge action={entry.action} />
      <span className="text-muted-foreground">call resolved:</span>
      <span className="tabular-nums">{formatPct(entry.actualReturnPct)}</span>
      {correct ? (
        <Check className="h-4 w-4 text-trend-up" aria-label="Correct" />
      ) : (
        <X className="h-4 w-4 text-trend-down" aria-label="Incorrect" />
      )}
    </div>
  );
}

export function WhatsNewCard() {
  const entries = useJournalStore((s) => s.entries);
  const refreshSignals = useWatchlistStore((s) => s.refreshSignals);
  const markChecked = useDigestStore((s) => s.markChecked);

  // Frozen once at mount, not read reactively — markChecked() updates the
  // store's lastCheckedAt later in this same mount, and if this read the
  // live value it would flip to "now" before computeNewlyResolved ever ran.
  const [checkpoint] = useState(() => useDigestStore.getState().lastCheckedAt);
  const [changes, setChanges] = useState<SignalChange[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // No empty-watchlist special case needed: refreshSignals() already
      // no-ops on zero tickers, and computeSignalChanges([], []) already
      // returns [] — the normal path below handles it correctly as-is.
      const currentStocks = useWatchlistStore.getState().stocks;
      const before = currentStocks.map(({ ticker, name, signal }) => ({ ticker, name, signal }));
      await refreshSignals();
      if (cancelled) return;

      const after = useWatchlistStore
        .getState()
        .stocks.map(({ ticker, name, signal }) => ({ ticker, name, signal }));
      setChanges(computeSignalChanges(before, after));
      markChecked();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshSignals, markChecked]);

  const newlyResolved = useMemo(
    () => computeNewlyResolved(entries, checkpoint),
    [entries, checkpoint],
  );

  const loading = changes === null;
  const changesList = changes ?? [];
  const hasContent = changesList.length > 0 || newlyResolved.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s New</CardTitle>
        <CardDescription>Since your last visit</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
        ) : !hasContent ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PartyPopper className="h-4 w-4" aria-hidden />
            You&apos;re all caught up.
          </div>
        ) : (
          <div className="space-y-3">
            {changesList.map((change) => (
              <div key={change.ticker} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{change.ticker}</span>
                <span className="text-muted-foreground">{change.companyName}</span>
                {change.from ? (
                  <span className="flex items-center gap-1">
                    <SignalBadge action={change.from} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">New:</span>
                )}
                <SignalBadge action={change.to} />
              </div>
            ))}
            {newlyResolved.map((entry) => (
              <JournalResolvedRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
