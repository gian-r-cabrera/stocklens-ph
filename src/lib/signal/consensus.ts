import { trendFromPrices } from "@/lib/forecast";
import { predictWithModel } from "@/lib/forecast/models";
import { BASELINE_MODELS, type BaselineModel, type ForecastModel } from "@/lib/forecast/types";
import type { MarketBar } from "@/lib/market/types";
import type { ConsensusSignal, ModelVote, SignalAction } from "@/lib/signal/types";

export const SIGNAL_HORIZON_DAYS = 7;
export const MIN_CLOSES_FOR_SIGNAL = 30;
export const SIGNAL_BUY_THRESHOLD = 0.3;
export const SIGNAL_AVOID_THRESHOLD = -0.3;
/** Fallback weighting kicks in when no model has usable backtested accuracy
 * (new symbol, thin backtest window) — confidence is capped low so the UI
 * can distinguish an equal-weight guess from a real accuracy-weighted read. */
const FALLBACK_CONFIDENCE_CAP = 34;

export const MODEL_LABELS: Record<BaselineModel, string> = {
  naive: "Naive Baseline",
  ma: "Moving Average",
  linear: "Linear Regression",
};

function directionSign(last: number, target: number): -1 | 0 | 1 {
  const trend = trendFromPrices(last, target);
  if (trend === "Projected Upward") return 1;
  if (trend === "Projected Downward") return -1;
  return 0;
}

/** 50% dirAccuracy (coin flip) weighs 0; 100% weighs 1. Sub-50% is floored
 * at 0 rather than inverted — treating a model that backtested worse than
 * random as a *contrarian* signal isn't safe or explainable. */
function weightFromAccuracy(dirAccuracy: number | null): number {
  if (dirAccuracy == null) return 0;
  return Math.max(0, dirAccuracy - 50) / 50;
}

function insufficientDataSignal(horizonDays: number): ConsensusSignal {
  return {
    action: "hold",
    score: 0,
    confidence: 0,
    votes: [],
    horizonDays,
    fallback: false,
    dataSufficient: false,
    rationale: `Insufficient price history (need at least ${MIN_CLOSES_FOR_SIGNAL} trading days) for a reliable signal.`,
  };
}

export function computeConsensusSignal(
  closes: number[],
  horizonDays: number,
  metrics: { model: BaselineModel; dirAccuracy: number | null }[],
): ConsensusSignal {
  if (closes.length < MIN_CLOSES_FOR_SIGNAL) {
    return insufficientDataSignal(horizonDays);
  }

  const lastClose = closes.at(-1)!;
  const dirAccuracyByModel = new Map(metrics.map((m) => [m.model, m.dirAccuracy]));

  const rawVotes: ModelVote[] = BASELINE_MODELS.map((model) => {
    const dirAccuracy = dirAccuracyByModel.get(model) ?? null;
    const forecastPrice = predictWithModel(model, closes, horizonDays).at(-1) ?? lastClose;
    return {
      model,
      direction: directionSign(lastClose, forecastPrice),
      weight: weightFromAccuracy(dirAccuracy),
      dirAccuracy,
      forecastPrice,
    };
  });

  const fallback = rawVotes.every((v) => v.weight === 0);
  const votes: ModelVote[] = fallback ? rawVotes.map((v) => ({ ...v, weight: 1 })) : rawVotes;

  const weightSum = votes.reduce((sum, v) => sum + v.weight, 0);
  const score = weightSum === 0 ? 0 : votes.reduce((sum, v) => sum + v.weight * v.direction, 0) / weightSum;

  let confidence = weightSum === 0 ? 0 : Math.round((100 * weightSum) / votes.length);
  if (fallback) confidence = Math.min(confidence, FALLBACK_CONFIDENCE_CAP);

  const action: SignalAction =
    score >= SIGNAL_BUY_THRESHOLD ? "buy" : score <= SIGNAL_AVOID_THRESHOLD ? "avoid" : "hold";

  const upVotes = votes.filter((v) => v.direction === 1).length;
  const rationale = fallback
    ? `${upVotes} of ${votes.length} baseline models (${votes.map((v) => MODEL_LABELS[v.model]).join(", ")}) project upside, using equal weighting — insufficient backtested-accuracy history for this ticker. Consensus confidence ${confidence}%.`
    : `${upVotes} of ${votes.length} baseline models project upside, weighted by each model's backtested directional accuracy. Consensus confidence ${confidence}%.`;

  return {
    action,
    score,
    confidence,
    votes,
    horizonDays,
    fallback,
    dataSufficient: true,
    rationale,
  };
}

/** Shared "bars → consensus signal" glue: sorts bars into closes, drops
 * LSTM (never backtested, no dirAccuracy to weight it by — see
 * computeConsensusSignal), and calls through. Both the stock-detail builder
 * and the batched /api/market/signals route need exactly this, so it lives
 * here once rather than being re-derived at each call site. */
export function computeTickerSignal(
  bars: MarketBar[],
  metrics: { model: ForecastModel; dirAccuracy: number | null }[],
  horizonDays: number = SIGNAL_HORIZON_DAYS,
): ConsensusSignal {
  const closes = [...bars]
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    .map((b) => Number(b.close));
  return computeConsensusSignal(
    closes,
    horizonDays,
    metrics
      .filter((m) => m.model !== "lstm")
      .map((m) => ({ model: m.model as BaselineModel, dirAccuracy: m.dirAccuracy })),
  );
}

/** Weighted average of each voting model's horizon-day price target, using
 * the same weights the consensus vote used (renormalized). Falls back to a
 * straight average when every weight is 0 (shouldn't happen post-fallback,
 * but keeps this safe to call independently). */
export function consensusTargetPrice(votes: ModelVote[]): number | null {
  if (votes.length === 0) return null;
  const weightSum = votes.reduce((sum, v) => sum + v.weight, 0);
  if (weightSum === 0) {
    return votes.reduce((sum, v) => sum + v.forecastPrice, 0) / votes.length;
  }
  return votes.reduce((sum, v) => sum + v.weight * v.forecastPrice, 0) / weightSum;
}
