"use client";

import { Check, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PriceChange } from "@/components/ui/price-change";
import { SignalBadge } from "@/components/ui/signal-badge";
import type { PriceDirection } from "@/lib/market/change-direction";
import { formatPriceAmount } from "@/lib/market/format-quote";
import { removeJournalEntryWithUndo } from "@/lib/journal/remove-with-undo";
import { isCorrect } from "@/lib/signal/backtest";
import { formatPct } from "@/lib/signal/format";
import type { JournalEntry } from "@/lib/journal/types";

function returnDirection(value: number | null): PriceDirection {
  if (value == null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const resolved = entry.status === "resolved" && entry.actualReturnPct != null;
  const correct = resolved && isCorrect(entry.action, entry.actualReturnPct!);

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{entry.ticker}</CardTitle>
            <CardDescription className="text-xs">{entry.loggedAt}</CardDescription>
          </div>
          <SignalBadge action={entry.action} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Entry</span>
          <span className="tabular-nums font-medium">
            {formatPriceAmount(entry.entryPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Stop / Target</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            {entry.stopLoss != null ? formatPriceAmount(entry.stopLoss) : "—"} /{" "}
            {entry.target != null ? formatPriceAmount(entry.target) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge
            variant={entry.status === "resolved" ? "secondary" : "outline"}
            className="text-xs"
          >
            {entry.status === "resolved" ? "Resolved" : "Pending"}
          </Badge>
        </div>
        {resolved && entry.actualPrice != null ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Outcome</span>
            <span className="flex items-center gap-1.5 tabular-nums font-medium">
              {formatPriceAmount(entry.actualPrice)}
              <PriceChange
                change={formatPct(entry.actualReturnPct)}
                direction={returnDirection(entry.actualReturnPct)}
                className="text-xs font-normal"
              />
              {correct ? (
                <Check className="h-3.5 w-3.5 text-trend-up" aria-label="Correct" />
              ) : (
                <X className="h-3.5 w-3.5 text-trend-down" aria-label="Incorrect" />
              )}
            </span>
          </div>
        ) : null}
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive"
            aria-label={`Remove ${entry.ticker} call`}
            onClick={() => removeJournalEntryWithUndo(entry)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function JournalCards({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="grid gap-4 md:hidden">
      {entries.map((entry) => (
        <JournalCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
