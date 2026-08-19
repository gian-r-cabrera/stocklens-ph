"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceChange } from "@/components/ui/price-change";
import { TrendBadge } from "@/components/ui/trend-badge";
import {
  filterStockDirectory,
  getDirectorySubsectors,
  getDirectorySectors,
  getEquityDirectoryCount,
  type StockDirectoryEntry,
} from "@/lib/data/stock-directory";
import {
  filterDirectoryByDividendYield,
  filterDirectoryByKind,
  filterDirectoryByPe,
  filterDirectoryByTier,
  sortDirectoryEntries,
  type DirectoryKindFilter,
  type DirectoryPeFilter,
  type DirectorySortKey,
  type DirectoryTierFilter,
  type DirectoryYieldFilter,
} from "@/lib/data/stock-directory-filters";
import { buildStocksBrowseUrl } from "@/lib/pse/sector-slug";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type StockDirectoryProps = {
  entries: StockDirectoryEntry[];
  sectorCounts: Record<string, number>;
  initialQuery?: string;
  initialSector?: string;
  initialSubsector?: string;
};

function resolveInitialSector(
  value: string | undefined,
  sectors: string[],
): string {
  if (!value) return "all";
  const decoded = decodeURIComponent(value);
  return sectors.includes(decoded) ? decoded : "all";
}

function KindBadge({ kind }: { kind: StockDirectoryEntry["kind"] }) {
  if (kind === "equity") return null;
  return (
    <Badge variant="outline" className="text-xs">
      {kind === "etf" ? "ETF" : "Index"}
    </Badge>
  );
}

function hasMarketPrice(entry: StockDirectoryEntry): boolean {
  return entry.lastClose !== "—";
}

/** Combined "P/E · Yield" cell — one compact column instead of two, since
 * the table is already horizontally scrollable and every extra header
 * narrows the rest. "—" per side when that figure isn't available. */
function formatPeAndYield(entry: StockDirectoryEntry): string {
  const pe = entry.peRatio != null ? `${entry.peRatio.toFixed(1)}x` : "—";
  const yieldPct =
    entry.dividendYieldPct != null ? `${entry.dividendYieldPct.toFixed(1)}%` : "—";
  return `${pe} · ${yieldPct}`;
}

function AnalysisBadge({ entry }: { entry: StockDirectoryEntry }) {
  if (entry.hasAnalysis && entry.trend) {
    return <TrendBadge trend={entry.trend} className="text-xs" />;
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Catalog
    </Badge>
  );
}

function DirectoryCard({ entry }: { entry: StockDirectoryEntry }) {
  return (
    <Card className="card-interactive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1">
              <CardTitle className="text-base">{entry.ticker}</CardTitle>
              <KindBadge kind={entry.kind} />
            </div>
            <CardDescription className="text-xs">{entry.name}</CardDescription>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.subsector}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {entry.sector}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="tabular-nums text-xl font-semibold">
            {entry.lastClose}
          </span>
          {hasMarketPrice(entry) ? (
            <PriceChange
              change={entry.dailyChange}
              direction={entry.changeDirection}
              className="text-sm"
            />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>P/E · Yield</span>
          <span className="tabular-nums">{formatPeAndYield(entry)}</span>
        </div>
        <AnalysisBadge entry={entry} />
        <Link href={`/stock/${entry.path}`} className="block">
          <Button variant="outline" size="sm" className="w-full">
            {entry.hasAnalysis ? "Analyze" : "View"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function DirectoryTable({ entries }: { entries: StockDirectoryEntry[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableCaption className="sr-only">
          PSE listed companies by official sector
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Last close</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>P/E · Yield</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.ticker}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-1">
                  {entry.ticker}
                  <KindBadge kind={entry.kind} />
                </span>
              </TableCell>
              <TableCell className="max-w-[160px] truncate">
                {entry.name}
              </TableCell>
              <TableCell className="max-w-[140px]">
                <div className="flex flex-col gap-0.5">
                  <Badge variant="outline" className="w-fit text-xs">
                    {entry.sector}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.subsector}
                  </span>
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{entry.lastClose}</TableCell>
              <TableCell>
                {hasMarketPrice(entry) ? (
                  <PriceChange
                    change={entry.dailyChange}
                    direction={entry.changeDirection}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums text-sm text-muted-foreground">
                {formatPeAndYield(entry)}
              </TableCell>
              <TableCell>
                <AnalysisBadge entry={entry} />
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/stock/${entry.path}`}>
                  <Button variant="outline" size="sm">
                    {entry.hasAnalysis ? "Analyze" : "View"}
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StockDirectory({
  entries,
  sectorCounts,
  initialQuery = "",
  initialSector,
  initialSubsector,
}: StockDirectoryProps) {
  const router = useRouter();
  const sectors = useMemo(() => getDirectorySectors(entries), [entries]);

  const [query, setQuery] = useState(initialQuery);
  const [sector, setSector] = useState(() =>
    resolveInitialSector(initialSector, sectors),
  );
  const [subsector, setSubsector] = useState(() => {
    if (!initialSubsector || initialSubsector === "all") return "all";
    return decodeURIComponent(initialSubsector);
  });
  const [tier, setTier] = useState<DirectoryTierFilter>("all");
  const [kind, setKind] = useState<DirectoryKindFilter>("all");
  const [peFilter, setPeFilter] = useState<DirectoryPeFilter>("all");
  const [yieldFilter, setYieldFilter] = useState<DirectoryYieldFilter>("all");
  const [sortKey, setSortKey] = useState<DirectorySortKey>("ticker");
  const [page, setPage] = useState(1);

  const subsectors = useMemo(
    () => getDirectorySubsectors(entries, sector),
    [entries, sector],
  );

  const [prevSector, setPrevSector] = useState(sector);
  if (sector !== prevSector) {
    setPrevSector(sector);
    if (subsector !== "all" && !subsectors.includes(subsector)) {
      setSubsector("all");
    }
  }

  const syncUrl = useCallback(
    (next: { query: string; sector: string; subsector: string }) => {
      const href = buildStocksBrowseUrl({
        query: next.query,
        sector: next.sector,
        subsector: next.subsector,
      });
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const filtered = useMemo(() => {
    let list = filterStockDirectory(entries, query, sector, subsector);
    list = filterDirectoryByTier(list, tier);
    list = filterDirectoryByKind(list, kind);
    list = filterDirectoryByPe(list, peFilter);
    list = filterDirectoryByDividendYield(list, yieldFilter);
    return sortDirectoryEntries(list, sortKey);
  }, [entries, query, sector, subsector, tier, kind, peFilter, yieldFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const filterKey = `${query}|${sector}|${subsector}|${tier}|${kind}|${peFilter}|${yieldFilter}|${sortKey}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    // Debounced — without this, every keystroke fired a router.replace().
    const id = setTimeout(() => {
      syncUrl({ query, sector, subsector });
    }, 300);
    return () => clearTimeout(id);
  }, [query, sector, subsector, syncUrl]);

  const equityCount = getEquityDirectoryCount();

  const clearFilters = () => {
    setQuery("");
    setSector("all");
    setSubsector("all");
    setTier("all");
    setKind("all");
    setPeFilter("all");
    setYieldFilter("all");
    setSortKey("ticker");
    setPage(1);
  };

  const tierChips: { id: DirectoryTierFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hasPrice", label: "Has price" },
    { id: "analyzed", label: "Demo forecast" },
    { id: "catalog", label: "Catalog only" },
  ];

  const kindChips: { id: DirectoryKindFilter; label: string }[] = [
    { id: "all", label: "All types" },
    { id: "equity", label: "Equities" },
    { id: "etf", label: "ETFs" },
    { id: "index", label: "Indices" },
  ];

  return (
    <div className="space-y-6">
      {/* Only the search box stays pinned on mobile — the full filter panel
          (selects + tier/kind chips + count) used to stick together and ate
          ~36% of a phone viewport once scrolled, leaving barely any room
          for results. */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker, company, sector..."
            className="pl-9"
            aria-label="Search stocks"
          />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Select
            value={sector}
            onValueChange={(v) => {
              if (v) {
                setSector(v);
                setSubsector("all");
              }
            }}
          >
            <SelectTrigger className="w-full lg:w-52" aria-label="Filter by sector">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {s} ({sectorCounts[s] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={subsector}
            onValueChange={(v) => v && setSubsector(v)}
            disabled={sector === "all"}
          >
            <SelectTrigger className="w-full lg:w-52" aria-label="Filter by subsector">
              <SelectValue placeholder="Subsector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subsectors</SelectItem>
              {subsectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={peFilter}
            onValueChange={(v) => v && setPeFilter(v as DirectoryPeFilter)}
          >
            <SelectTrigger className="w-full lg:w-36" aria-label="Filter by P/E ratio">
              <SelectValue placeholder="P/E" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">P/E: Any</SelectItem>
              <SelectItem value="under10">P/E: Under 10x</SelectItem>
              <SelectItem value="under15">P/E: Under 15x</SelectItem>
              <SelectItem value="under20">P/E: Under 20x</SelectItem>
              <SelectItem value="under30">P/E: Under 30x</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={yieldFilter}
            onValueChange={(v) => v && setYieldFilter(v as DirectoryYieldFilter)}
          >
            <SelectTrigger className="w-full lg:w-44" aria-label="Filter by dividend yield">
              <SelectValue placeholder="Dividend Yield" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Dividend Yield: Any</SelectItem>
              <SelectItem value="atLeast2">Dividend Yield: 2%+</SelectItem>
              <SelectItem value="atLeast4">Dividend Yield: 4%+</SelectItem>
              <SelectItem value="atLeast6">Dividend Yield: 6%+</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortKey}
            onValueChange={(v) => v && setSortKey(v as DirectorySortKey)}
          >
            <SelectTrigger className="w-full lg:w-48" aria-label="Sort stocks">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ticker">Sort: Ticker A–Z</SelectItem>
              <SelectItem value="change">Sort: % change</SelectItem>
              <SelectItem value="price">Sort: Last close</SelectItem>
              <SelectItem value="peRatio">Sort: P/E (low to high)</SelectItem>
              <SelectItem value="dividendYield">Sort: Dividend yield (high to low)</SelectItem>
              <SelectItem value="marketCap">Sort: Market cap (high to low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {tierChips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={tier === chip.id}
              className={cn(tier === chip.id && "border-primary bg-primary/10")}
              onClick={() => setTier(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {kindChips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={kind === chip.id}
              className={cn(kind === chip.id && "border-primary bg-primary/10")}
              onClick={() => setKind(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
          ( {entries.length} total · {equityCount} listed equities )
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">
              No stocks match your search.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <DirectoryTable entries={pageEntries} />
          <div className="grid gap-4 md:hidden">
            {pageEntries.map((entry) => (
              <DirectoryCard key={entry.ticker} entry={entry} />
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
