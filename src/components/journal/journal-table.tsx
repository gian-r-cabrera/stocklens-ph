"use client";

import { Check, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChange } from "@/components/ui/price-change";
import { SignalBadge } from "@/components/ui/signal-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function StatusBadge({ status }: { status: JournalEntry["status"] }) {
  return (
    <Badge variant={status === "resolved" ? "secondary" : "outline"} className="text-xs">
      {status === "resolved" ? "Resolved" : "Pending"}
    </Badge>
  );
}

function CorrectIcon({ entry }: { entry: JournalEntry }) {
  if (entry.status !== "resolved" || entry.actualReturnPct == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return isCorrect(entry.action, entry.actualReturnPct) ? (
    <Check className="h-4 w-4 text-trend-up" aria-label="Correct" />
  ) : (
    <X className="h-4 w-4 text-trend-down" aria-label="Incorrect" />
  );
}

/** Actual price + return, combined into one cell (same "merge related
 * figures" pattern already used for Stop/Target in this table) — one
 * fewer column than showing them separately. */
function OutcomeCell({ entry }: { entry: JournalEntry }) {
  if (entry.status !== "resolved" || entry.actualPrice == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex items-center gap-1.5 tabular-nums">
      {formatPriceAmount(entry.actualPrice)}
      <PriceChange
        change={formatPct(entry.actualReturnPct)}
        direction={returnDirection(entry.actualReturnPct)}
        className="text-xs font-normal"
      />
    </span>
  );
}

export function JournalTable({ entries }: { entries: JournalEntry[] }) {
  return (
    <Card className="hidden md:block">
      <CardHeader>
        <CardTitle>Logged Calls</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Logged</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Stop / Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Correct</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.ticker}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.loggedAt}
                </TableCell>
                <TableCell>
                  <SignalBadge action={entry.action} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatPriceAmount(entry.entryPrice)}
                </TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {entry.stopLoss != null ? formatPriceAmount(entry.stopLoss) : "—"} /{" "}
                  {entry.target != null ? formatPriceAmount(entry.target) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={entry.status} />
                </TableCell>
                <TableCell>
                  <OutcomeCell entry={entry} />
                </TableCell>
                <TableCell>
                  <CorrectIcon entry={entry} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove ${entry.ticker} call`}
                    onClick={() => removeJournalEntryWithUndo(entry)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
