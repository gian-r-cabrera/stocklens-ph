import Link from "next/link";

import { sectorToSlug } from "@/lib/pse/sector-slug";
import { buildSectorCounts } from "@/lib/data/stock-directory-filters";
import type { StockDirectoryEntry } from "@/lib/data/stock-directory";

type SectorSummaryProps = {
  entries: StockDirectoryEntry[];
};

export function SectorSummary({ entries }: SectorSummaryProps) {
  const counts = buildSectorCounts(entries);
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  const max = rows[0]?.[1] ?? 1;

  return (
    <section className="space-y-3" aria-label="Stocks by sector">
      <h2 className="text-lg font-medium">By sector</h2>
      <ul className="space-y-2">
        {rows.map(([sector, count]) => (
          <li key={sector}>
            <Link
              href={`/stocks?sector=${encodeURIComponent(sector)}`}
              className="group flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-muted/50"
            >
              <span className="w-36 shrink-0 truncate text-sm sm:w-44">
                {sector}
              </span>
              <span
                className="h-2 rounded-full bg-primary/70 transition-all group-hover:bg-primary"
                style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                aria-hidden
              />
              <span className="tabular-nums text-sm text-muted-foreground">
                {count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Or browse by sector:{" "}
        {rows.map(([sector], i) => (
          <span key={sector}>
            {i > 0 ? " · " : ""}
            <Link
              href={`/stocks/sector/${sectorToSlug(sector)}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {sector}
            </Link>
          </span>
        ))}
      </p>
    </section>
  );
}
