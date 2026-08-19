import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPriceAmount, parsePriceAmount } from "@/lib/market/format-quote";
import type { StockAnalysis } from "@/lib/types/stock-analysis";

function formatMoney(value: number | null): string {
  return value != null ? formatPriceAmount(value) : "—";
}

function formatPerShare(value: number | null): string {
  return value != null ? `₱${value.toFixed(2)}` : "—";
}

function formatRatio(value: number | null): string {
  return value != null ? `${value.toFixed(2)}x` : "—";
}

function formatPct(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

/** P/E and P/B aren't meaningful for a loss-making or negative-equity
 * company under the conventional definition — showing a negative
 * "ratio" there would read as a real number instead of the edge case
 * it is, so those cases fall back to "—" like any other missing value. */
function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

export function StockFundamentals({ analysis }: { analysis: StockAnalysis }) {
  const { fundamentals } = analysis;
  if (!fundamentals) return null;

  const lastPrice = parsePriceAmount(analysis.metrics.lastClose);
  const peRatio = ratio(lastPrice, fundamentals.epsBasicTtm);
  const pbRatio = ratio(lastPrice, fundamentals.bookValuePerShare);
  const debtToEquity = ratio(fundamentals.totalLiabilities, fundamentals.stockholdersEquity);
  const dividendYieldRatio = ratio(fundamentals.dividendPerShareTtm, lastPrice);
  const dividendYield = dividendYieldRatio != null ? dividendYieldRatio * 100 : null;
  const netMarginYtd =
    fundamentals.netIncomeYtd != null && fundamentals.grossRevenueYtd
      ? (fundamentals.netIncomeYtd / fundamentals.grossRevenueYtd) * 100
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fundamentals</CardTitle>
        <CardDescription>
          From the latest quarterly report filed on PSE EDGE (period ended{" "}
          {fundamentals.periodEnded}). P/E, P/B, and Dividend Yield use today&apos;s price
          against the filing&apos;s trailing-12-month EPS, book value, and cash dividends
          declared.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Stat label="P/E Ratio" value={formatRatio(peRatio)} />
        <Stat label="P/B Ratio" value={formatRatio(pbRatio)} />
        <Stat label="Debt / Equity" value={formatRatio(debtToEquity)} />
        <Stat label="Dividend Yield (TTM)" value={formatPct(dividendYield)} />
        <Stat label="EPS (Trailing 12mo)" value={formatPerShare(fundamentals.epsBasicTtm)} />
        <Stat label="Book Value / Share" value={formatPerShare(fundamentals.bookValuePerShare)} />
        <Stat
          label="Dividend / Share (TTM)"
          value={formatPerShare(fundamentals.dividendPerShareTtm)}
        />
        <Stat label="Revenue (Year-to-date)" value={formatMoney(fundamentals.grossRevenueYtd)} />
        <Stat
          label="Net Income (Year-to-date)"
          value={formatMoney(fundamentals.netIncomeYtd)}
        />
        <Stat label="Net Margin (YTD)" value={formatPct(netMarginYtd)} />
      </CardContent>
    </Card>
  );
}
