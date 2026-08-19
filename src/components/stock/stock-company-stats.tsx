import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPriceAmount } from "@/lib/market/format-quote";
import type { StockAnalysis } from "@/lib/types/stock-analysis";

function formatShares(value: number | null): string {
  return value != null ? Math.round(value).toLocaleString("en-PH") : "—";
}

function formatPct(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : "—";
}

function formatMoney(value: number | null): string {
  return value != null ? formatPriceAmount(value) : "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export function StockCompanyStats({ analysis }: { analysis: StockAnalysis }) {
  const { companyStats } = analysis;
  if (!companyStats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Stats</CardTitle>
        <CardDescription>
          Size and ownership reference data from PSE EDGE. See the Fundamentals card below
          for P/E, EPS, and other earnings-based figures.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Stat label="Market Cap" value={formatMoney(companyStats.marketCap)} />
        <Stat label="Outstanding Shares" value={formatShares(companyStats.outstandingShares)} />
        <Stat label="Free Float" value={formatPct(companyStats.freeFloatPct)} />
        <Stat
          label="Foreign Ownership Limit"
          value={formatPct(companyStats.foreignOwnershipLimitPct)}
        />
        <Stat label="Par Value" value={formatMoney(companyStats.parValue)} />
      </CardContent>
    </Card>
  );
}
