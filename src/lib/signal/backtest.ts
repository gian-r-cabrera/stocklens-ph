import { walkForwardBacktest } from "@/lib/forecast/backtest";
import type { BaselineModel } from "@/lib/forecast/types";
import type { MarketBar } from "@/lib/market/types";
import {
  MIN_CLOSES_FOR_SIGNAL,
  SIGNAL_HORIZON_DAYS,
  computeConsensusSignal,
} from "@/lib/signal/consensus";
import type { SignalAction } from "@/lib/signal/types";

export type SignalBacktestTrial = {
  date: string;
  action: SignalAction;
  confidence: number;
  forwardReturnPct: number;
};

export type SignalActionStats = {
  count: number;
  hitRate: number | null;
  avgReturnPct: number | null;
};

export type SignalBacktestResult = {
  horizonDays: number;
  trials: SignalBacktestTrial[];
  byAction: Record<SignalAction, SignalActionStats>;
  baselineAvgReturnPct: number | null;
};

/** Matches trendFromPrices' 1% deadband, so "correct" here means the same
 * thing "Projected Upward/Downward" means everywhere else in the app. */
const DIRECTION_DEADBAND_PCT = 1;
const DEFAULT_STEP = 3;
/** walkForwardBacktest only ever looks at the trailing 90 closes of
 * whatever it's given (its own WALK_FORWARD_DAYS, not exported) — passing
 * it the full ever-growing prefix at each step re-sorts data it's going to
 * discard anyway, cost growing with history length. Pre-trimming to the
 * same trailing window keeps results identical (walkForwardBacktest would
 * arrive at the same 90 closes either way) while keeping the sort cheap. */
const WALK_FORWARD_TRAILING_WINDOW = 90;

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Exported so any other consumer of a resolved (action, forwardReturnPct)
 * pair — e.g. the prediction journal — can use the exact same definition
 * of "correct" this backtest's hit-rate stats use. */
export function isCorrect(action: SignalAction, forwardReturnPct: number): boolean {
  if (action === "buy") return forwardReturnPct > DIRECTION_DEADBAND_PCT;
  if (action === "avoid") return forwardReturnPct < -DIRECTION_DEADBAND_PCT;
  return Math.abs(forwardReturnPct) <= DIRECTION_DEADBAND_PCT;
}

export function aggregateTrials(trials: SignalBacktestTrial[]): {
  byAction: Record<SignalAction, SignalActionStats>;
  baselineAvgReturnPct: number | null;
} {
  const actions: SignalAction[] = ["buy", "hold", "avoid"];
  const byAction = {} as Record<SignalAction, SignalActionStats>;

  for (const action of actions) {
    const bucket = trials.filter((t) => t.action === action);
    const correct = bucket.filter((t) => isCorrect(t.action, t.forwardReturnPct));
    byAction[action] = {
      count: bucket.length,
      hitRate: bucket.length ? (correct.length / bucket.length) * 100 : null,
      avgReturnPct: average(bucket.map((t) => t.forwardReturnPct)),
    };
  }

  return {
    byAction,
    baselineAvgReturnPct: average(trials.map((t) => t.forwardReturnPct)),
  };
}

/**
 * Walks back through `bars` and, at each historical day `t`, regenerates
 * exactly what the live consensus signal would have said using only data
 * available through that day — backtested model weights included (via
 * walkForwardBacktest on bars.slice(0, t+1), which only ever looks at its
 * own trailing 90-close window, so this is naturally lookahead-free). Then
 * checks what actually happened over the following `horizonDays`.
 */
export function backtestConsensusSignal(
  bars: MarketBar[],
  horizonDays: number = SIGNAL_HORIZON_DAYS,
  step = DEFAULT_STEP,
): SignalBacktestResult {
  const sorted = [...bars].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const closes = sorted.map((b) => Number(b.close));
  const trials: SignalBacktestTrial[] = [];

  for (let t = MIN_CLOSES_FOR_SIGNAL - 1; t + horizonDays < closes.length; t += step) {
    const closesUpToT = closes.slice(0, t + 1);
    const trailingBars = sorted.slice(Math.max(0, t + 1 - WALK_FORWARD_TRAILING_WINDOW), t + 1);
    const metrics = walkForwardBacktest(trailingBars, horizonDays);
    const signal = computeConsensusSignal(
      closesUpToT,
      horizonDays,
      metrics.map((m) => ({ model: m.model as BaselineModel, dirAccuracy: m.dirAccuracy })),
    );
    if (!signal.dataSufficient) continue;

    const entryClose = closes[t]!;
    const exitClose = closes[t + horizonDays]!;
    trials.push({
      date: sorted[t]!.tradeDate,
      action: signal.action,
      confidence: signal.confidence,
      forwardReturnPct: ((exitClose - entryClose) / entryClose) * 100,
    });
  }

  return { horizonDays, trials, ...aggregateTrials(trials) };
}
