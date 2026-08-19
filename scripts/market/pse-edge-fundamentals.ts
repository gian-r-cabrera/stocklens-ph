/**
 * PSE EDGE quarterly-report fundamentals + trailing-12mo cash dividends.
 * The disclosure viewer's "Main Document" is the SEC Form 17-Q cover sheet
 * rendered as structured HTML (not just a PDF wrapper) — its Balance Sheet
 * (#BS) and Income Statement (#IS/#ISSUB) tables carry real Total Assets/
 * Liabilities, Book Value/Share, Revenue, Net Income, and EPS (basic/
 * diluted, trailing 12mo). Three chained requests per company: find the
 * latest "Quarterly Report" disclosure, resolve its viewer to a
 * cover-sheet file_id, fetch that HTML. Dividend history comes from a
 * separate, independent endpoint (PSE EDGE's Dividends and Rights page)
 * fetched concurrently with that chain, not part of it.
 */
import type { Fundamentals } from "../../src/lib/market/types";

const DISCLOSURES_SEARCH_URL = "https://edge.pse.com.ph/companyDisclosures/search.ax";
const VIEWER_URL = "https://edge.pse.com.ph/openDiscViewer.do";
const DOWNLOAD_HTML_URL = "https://edge.pse.com.ph/downloadHtml.do";
const DIVIDENDS_URL =
  "https://edge.pse.com.ph/companyPage/dividends_and_rights_list.ax?DividendsOrRights=Dividends";
const USER_AGENT = "StockLensPH-ingest/1.0 (educational; PSE EDGE fundamentals)";

export type FundamentalsInput = {
  symbol: string;
  companyId: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Generic `<tr>` → cell-text-array extractor, used against the cover
 * sheet's `<table class="type1">`-style rows (first cell is the row label,
 * remaining cells are its values in column order). */
export function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  for (const trMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...trMatch[1]!.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(
      (m) => stripTags(m[1]!),
    );
    rows.push(cells);
  }
  return rows;
}

function extractTableById(html: string, id: string): string | null {
  const match = html.match(new RegExp(`<table[^>]*id="${id}"[^>]*>([\\s\\S]*?)</table>`, "i"));
  return match ? match[1]! : null;
}

function rowsToLabelMap(rows: string[][]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (row.length >= 2) map.set(row[0]!, row.slice(1));
  }
  return map;
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "--") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function scaled(value: number | null, scale: number): number | null {
  return value == null ? null : value * scale;
}

/** The cover sheet states units explicitly per filing (seen both "Phil.
 * Peso in Millions" and "PHP (In Thousands)" across real filings) — never
 * assume a scale, always read it. EPS/Book Value per Share are excluded
 * by the form's own convention and are never scaled by this. */
function unitScale(unitsText: string | undefined): number {
  if (!unitsText) return 1;
  const lower = unitsText.toLowerCase();
  if (lower.includes("million")) return 1_000_000;
  if (lower.includes("thousand")) return 1_000;
  return 1;
}

const MONTH_NUMBERS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/** Parses "Jun 30, 2026" → "2026-06-30" via explicit string matching, not
 * `new Date(...).toISOString()` — the latter parses in local time then
 * converts to UTC, silently shifting the date by a day for any timezone
 * behind UTC (caught by the fixture test: "Jun 30" became "Jun 29"). */
function parseFilingDate(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.trim().match(/^([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;
  const month = MONTH_NUMBERS[match[1]!];
  if (!month) return null;
  return `${match[3]}-${month}-${match[2]!.padStart(2, "0")}`;
}

export function parseFinancialTables(
  html: string,
  symbol: string,
): Omit<Fundamentals, "asOf"> | null {
  // The period/units table is `<table class="type1">` with no other
  // attributes — #BS/#IS/#ISSUB all additionally carry an `id`, so this
  // exact-match regex only ever hits the period table.
  const periodMatch = html.match(/<table class="type1">([\s\S]*?)<\/table>/i);
  const periodByLabel = rowsToLabelMap(periodMatch ? parseTableRows(periodMatch[1]!) : []);
  const periodEnded = parseFilingDate(periodByLabel.get("For the period ended")?.[0]);
  const scale = unitScale(periodByLabel.get("Currency (indicate units, if applicable)")?.[0]);

  const bsHtml = extractTableById(html, "BS");
  const isHtml = extractTableById(html, "IS");
  if (!bsHtml || !isHtml || !periodEnded) return null;

  const bs = rowsToLabelMap(parseTableRows(bsHtml));
  const is = rowsToLabelMap(parseTableRows(isHtml));
  const isSubHtml = extractTableById(html, "ISSUB");
  const isSub = rowsToLabelMap(isSubHtml ? parseTableRows(isSubHtml) : []);

  // BS columns: [current period, prior fiscal year-end] — want current (0).
  const totalAssets = scaled(parseNumber(bs.get("Total Assets")?.[0]), scale);
  const totalLiabilities = scaled(parseNumber(bs.get("Total Liabilities")?.[0]), scale);
  const stockholdersEquity = scaled(parseNumber(bs.get("Stockholders' Equity")?.[0]), scale);
  const bookValuePerShare = parseNumber(bs.get("Book Value per Share")?.[0]);

  // IS columns: [current qtr, prior-year qtr, current YTD, prior YTD] — want YTD (2).
  const grossRevenueYtd = scaled(parseNumber(is.get("Gross Revenue")?.[2]), scale);
  const netIncomeYtd = scaled(parseNumber(is.get("Net Income/(Loss) After Tax")?.[2]), scale);

  // ISSUB columns: [current TTM, prior-year TTM] — want current (0).
  const epsBasicTtm = parseNumber(isSub.get("Earnings/(Loss) Per Share (Basic)")?.[0]);
  const epsDilutedTtm = parseNumber(isSub.get("Earnings/(Loss) Per Share (Diluted)")?.[0]);

  return {
    symbol: symbol.toUpperCase(),
    periodEnded,
    totalAssets,
    totalLiabilities,
    stockholdersEquity,
    bookValuePerShare,
    grossRevenueYtd,
    netIncomeYtd,
    epsBasicTtm,
    epsDilutedTtm,
    // Filled in separately by fetchLatestQuarterlyFundamentals — this
    // cover sheet has no dividend data, that's a different PSE EDGE page.
    dividendPerShareTtm: null,
  };
}

function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Constructs from explicit numeric Y/M/D (not by parsing a string) so
 * there's no ambiguity to introduce, then extracts back via the same
 * local accessors — construction and extraction stay symmetric, so this
 * is safe regardless of runtime timezone. */
function isoDaysBefore(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() - days);
  return dateOnlyToIso(date);
}

/** The "per share" suffix is inconsistent across real filings — BDO's
 * common dividends have it ("Php 1.10 per share" / "Php1.10 per share"),
 * JFC's don't ("Php1.33" alone) — so it's optional here, not required. */
function parseDividendRate(raw: string): number | null {
  const match = raw.match(/Php\s*([\d,]+\.?\d*)(?:\s*per\s*share)?/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1]!.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Sums COMMON/Cash dividend rates with an ex-dividend date in the
 * trailing 12 months of `asOfIso`. `asOfIso` is a parameter rather than
 * read via `new Date()` internally so this stays pure and deterministic
 * to test — the caller supplies "now". Stock/property dividends and
 * preferred-share dividends are excluded; they aren't part of a common
 * shareholder's cash yield. */
export function parseDividendPerShareTtm(html: string, asOfIso: string): number | null {
  const tableMatch = html.match(/<table class="list">([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const cutoffIso = isoDaysBefore(asOfIso, 365);
  let total = 0;
  let any = false;

  for (const row of parseTableRows(tableMatch[1]!)) {
    if (row.length < 4) continue;
    const [typeOfSecurity, typeOfDividend, rateRaw, exDateRaw] = row;
    if (typeOfSecurity?.toUpperCase() !== "COMMON") continue;
    if (typeOfDividend?.toUpperCase() !== "CASH") continue;

    const rate = parseDividendRate(rateRaw ?? "");
    const exDateIso = parseFilingDate(exDateRaw);
    if (rate == null || !exDateIso) continue;
    if (exDateIso < cutoffIso || exDateIso > asOfIso) continue;

    total += rate;
    any = true;
  }

  return any ? total : null;
}

async function findLatestQuarterlyEdgeNo(companyId: string): Promise<string | null> {
  const body = new URLSearchParams({
    keyword: companyId,
    companyId,
    tmplNm: "Quarterly",
    pageNo: "1",
  });
  const res = await fetch(DISCLOSURES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const match = (await res.text()).match(/openPopup\('([a-f0-9]+)'\)/);
  return match ? match[1]! : null;
}

async function findCoverSheetFileId(edgeNo: string): Promise<string | null> {
  const res = await fetch(`${VIEWER_URL}?edge_no=${edgeNo}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const match = (await res.text()).match(/downloadHtml\.do\?file_id=(\d+)/);
  return match ? match[1]! : null;
}

async function fetchCoverSheetHtml(fileId: string): Promise<string | null> {
  const res = await fetch(`${DOWNLOAD_HTML_URL}?file_id=${fileId}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  return res.ok ? res.text() : null;
}

async function fetchQuarterlyCoverSheet(
  companyId: string,
  symbol: string,
  delayMs: number,
): Promise<Omit<Fundamentals, "asOf"> | null> {
  const edgeNo = await findLatestQuarterlyEdgeNo(companyId);
  if (delayMs > 0) await sleep(delayMs);
  if (!edgeNo) return null;

  const fileId = await findCoverSheetFileId(edgeNo);
  if (delayMs > 0) await sleep(delayMs);
  if (!fileId) return null;

  const html = await fetchCoverSheetHtml(fileId);
  if (delayMs > 0) await sleep(delayMs);
  if (!html) return null;

  return parseFinancialTables(html, symbol);
}

async function fetchDividendPerShareTtm(
  companyId: string,
  delayMs: number,
): Promise<number | null> {
  const res = await fetch(DIVIDENDS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ cmpy_id: companyId }).toString(),
  });
  if (delayMs > 0) await sleep(delayMs);
  if (!res.ok) return null;

  const html = await res.text();
  return parseDividendPerShareTtm(html, dateOnlyToIso(new Date()));
}

/** The quarterly cover-sheet chain and the dividends fetch hit different
 * PSE EDGE pages independently — running them concurrently instead of
 * chained after each other halves this function's latency without adding
 * a fourth sequential round trip. */
export async function fetchLatestQuarterlyFundamentals(
  companyId: string,
  symbol: string,
  delayMs = 100,
): Promise<Fundamentals | null> {
  const [quarterly, dividendPerShareTtm] = await Promise.all([
    fetchQuarterlyCoverSheet(companyId, symbol, delayMs),
    fetchDividendPerShareTtm(companyId, delayMs),
  ]);
  if (!quarterly) return null;

  return { ...quarterly, dividendPerShareTtm, asOf: new Date() };
}

export async function fetchFundamentalsList(
  inputs: FundamentalsInput[],
  options?: {
    delayMs?: number;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<Fundamentals[]> {
  const delayMs = options?.delayMs ?? 100;
  const concurrency = options?.concurrency ?? 6;
  let completed = 0;

  const results = await mapPool(inputs, concurrency, async (input) => {
    const stats = await fetchLatestQuarterlyFundamentals(input.companyId, input.symbol, delayMs);
    completed++;
    options?.onProgress?.(completed, inputs.length);
    return stats;
  });

  return results.filter((s): s is Fundamentals => s != null);
}
