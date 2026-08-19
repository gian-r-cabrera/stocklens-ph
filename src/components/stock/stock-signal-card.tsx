"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PriceDirectionIcon } from "@/components/ui/price-change";
import { SignalBadge } from "@/components/ui/signal-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPriceAmount, parsePriceAmount } from "@/lib/market/format-quote";
import type { PriceDirection } from "@/lib/market/change-direction";
import { MODEL_LABELS } from "@/lib/signal/consensus";
import { useJournalStore } from "@/lib/stores/journal-store";
import type { StockAnalysis } from "@/lib/types/stock-analysis";

const VOTE_DIRECTION: Record<-1 | 0 | 1, PriceDirection> = {
  1: "up",
  0: "flat",
  "-1": "down",
};

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular-nums text-lg font-semibold">{value}</div>
    </div>
  );
}

export function StockSignalCard({ analysis }: { analysis: StockAnalysis }) {
  const { signal, entryExitPlan } = analysis;
  const addEntry = useJournalStore((s) => s.addEntry);
  if (!signal) return null;

  const handleLog = () => {
    const entryPrice = entryExitPlan?.entry ?? parsePriceAmount(analysis.metrics.lastClose) ?? 0;
    addEntry({
      ticker: analysis.info.ticker,
      companyName: analysis.info.name,
      action: signal.action,
      confidence: signal.confidence,
      horizonDays: signal.horizonDays,
      entryPrice,
      stopLoss: entryExitPlan?.stopLoss ?? null,
      target: entryExitPlan?.target ?? null,
      rationale: signal.rationale,
    });
    toast.message(`Logged ${analysis.info.ticker} ${signal.action} call to your journal.`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Signal</CardTitle>
          <div className="flex items-center gap-2">
            <SignalBadge action={signal.action} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!signal.dataSufficient}
              onClick={handleLog}
            >
              Log this call
            </Button>
          </div>
        </div>
        <CardDescription>
          {signal.dataSufficient
            ? `Consensus over the next ${signal.horizonDays} trading days · ${signal.confidence}% confidence`
            : "Insufficient price history for a reliable signal"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{signal.rationale}</p>

        {signal.votes.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Backtested accuracy</TableHead>
                  <TableHead>Vote weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signal.votes.map((vote) => (
                  <TableRow key={vote.model}>
                    <TableCell className="font-medium">{MODEL_LABELS[vote.model]}</TableCell>
                    <TableCell>
                      <PriceDirectionIcon
                        direction={VOTE_DIRECTION[vote.direction]}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell>
                      {vote.dirAccuracy != null ? `${vote.dirAccuracy.toFixed(1)}%` : "N/A"}
                    </TableCell>
                    <TableCell>{Math.round(vote.weight * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {entryExitPlan && (
          <div className="space-y-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <PlanStat label="Entry" value={formatPriceAmount(entryExitPlan.entry)} />
              <PlanStat label="Stop-loss" value={formatPriceAmount(entryExitPlan.stopLoss)} />
              <PlanStat
                label="Target"
                value={entryExitPlan.target != null ? formatPriceAmount(entryExitPlan.target) : "—"}
              />
              <PlanStat
                label="Risk / Reward"
                value={
                  entryExitPlan.riskRewardRatio != null
                    ? `${entryExitPlan.riskRewardRatio.toFixed(2)}:1`
                    : "—"
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">{entryExitPlan.rationale}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
