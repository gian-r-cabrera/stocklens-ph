import type { SignalAction } from "@/lib/signal/types";

export type SignalChange = {
  ticker: string;
  companyName: string;
  /** null = first time a signal has been seen for this ticker, not a real "change". */
  from: SignalAction | null;
  to: SignalAction;
};
