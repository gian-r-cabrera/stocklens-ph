import type { SignalAction } from "@/lib/signal/types";

export type JournalEntryStatus = "pending" | "resolved";

export type JournalEntry = {
  id: string;
  ticker: string;
  companyName: string;
  /** YYYY-MM-DD, the date the call was logged. */
  loggedAt: string;
  action: SignalAction;
  confidence: number;
  horizonDays: number;
  entryPrice: number;
  stopLoss: number | null;
  target: number | null;
  rationale: string;
  status: JournalEntryStatus;
  resolvedAt: string | null;
  actualPrice: number | null;
  actualReturnPct: number | null;
};

export type NewJournalEntryInput = {
  ticker: string;
  companyName: string;
  action: SignalAction;
  confidence: number;
  horizonDays: number;
  entryPrice: number;
  stopLoss: number | null;
  target: number | null;
  rationale: string;
};
