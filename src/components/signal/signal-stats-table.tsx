import { SignalBadge } from "@/components/ui/signal-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHitRate, formatPct, SIGNAL_ACTIONS } from "@/lib/signal/format";
import type { SignalActionStats } from "@/lib/signal/backtest";
import type { SignalAction } from "@/lib/signal/types";

export function SignalStatsTable({
  byAction,
  countLabel,
}: {
  byAction: Record<SignalAction, SignalActionStats>;
  countLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Signal</TableHead>
            <TableHead>{countLabel}</TableHead>
            <TableHead>Hit Rate</TableHead>
            <TableHead>Avg Return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SIGNAL_ACTIONS.map((action) => {
            const stats = byAction[action];
            return (
              <TableRow key={action}>
                <TableCell>
                  <SignalBadge action={action} />
                </TableCell>
                <TableCell>{stats.count}</TableCell>
                <TableCell>{formatHitRate(stats.hitRate)}</TableCell>
                <TableCell>{formatPct(stats.avgReturnPct)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
