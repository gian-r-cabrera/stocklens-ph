"use client";

import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalBadge } from "@/components/ui/signal-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPriceAmount } from "@/lib/market/format-quote";
import { isCorrect } from "@/lib/signal/backtest";
import { formatPct } from "@/lib/signal/format";
import type { JournalEntry } from "@/lib/journal/types";
import { useJournalStore } from "@/lib/stores/journal-store";

function StatusBadge({ status }: { status: JournalEntry["status"] }) {
  return (
    <Badge variant={status === "resolved" ? "secondary" : "outline"} className="text-xs">
      {status === "resolved" ? "Resolved" : "Pending"}
    </Badge>
  );
}

export function JournalTable({ entries }: { entries: JournalEntry[] }) {
  const removeEntry = useJournalStore((s) => s.removeEntry);

  const handleRemove = (entry: JournalEntry) => {
    removeEntry(entry.id);
    toast.message(`Removed ${entry.ticker} call from your journal.`, {
      action: {
        label: "Undo",
        onClick: () => useJournalStore.getState().restoreEntry(entry),
      },
    });
  };

  return (
    <Card>
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
              <TableHead>Actual</TableHead>
              <TableHead>Return</TableHead>
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
                <TableCell>{formatPriceAmount(entry.entryPrice)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.stopLoss != null ? formatPriceAmount(entry.stopLoss) : "—"} /{" "}
                  {entry.target != null ? formatPriceAmount(entry.target) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={entry.status} />
                </TableCell>
                <TableCell>
                  {entry.actualPrice != null ? formatPriceAmount(entry.actualPrice) : "—"}
                </TableCell>
                <TableCell>{formatPct(entry.actualReturnPct)}</TableCell>
                <TableCell>
                  {entry.status === "resolved" && entry.actualReturnPct != null ? (
                    isCorrect(entry.action, entry.actualReturnPct) ? (
                      <Check className="h-4 w-4 text-trend-up" aria-label="Correct" />
                    ) : (
                      <X className="h-4 w-4 text-trend-down" aria-label="Incorrect" />
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove ${entry.ticker} call`}
                    onClick={() => handleRemove(entry)}
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
