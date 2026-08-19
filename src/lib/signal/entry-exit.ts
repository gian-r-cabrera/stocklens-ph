import { formatPriceAmount } from "@/lib/market/format-quote";
import type { SwingLevel } from "@/lib/market/indicators";
import type { EntryExitPlan, SignalAction } from "@/lib/signal/types";

export const ATR_STOP_MULTIPLIER = 2;
export const ATR_FALLBACK_PCT = 0.03;
export const MIN_HEALTHY_RR = 1.5;
/** How close (below current price) a support level must be to count as a
 * plausible pullback entry for a "hold" plan, rather than just using the
 * current price. */
const HOLD_PULLBACK_BAND_PCT = 0.08;

export function computeEntryExitPlan(
  action: SignalAction,
  lastClose: number,
  atr14: number | null,
  support: SwingLevel | null,
  resistance: SwingLevel | null,
  consensusTarget: number | null,
): EntryExitPlan | null {
  // No stop-loss/target shown for a stock the signal just said to avoid —
  // that would imply a trade recommendation that doesn't exist.
  if (action === "avoid") return null;

  const entry =
    action === "buy"
      ? lastClose
      : support && support.price < lastClose && support.price >= lastClose * (1 - HOLD_PULLBACK_BAND_PCT)
        ? support.price
        : lastClose;

  const atrFallback = atr14 == null;
  const rawStopLoss = atrFallback
    ? entry * (1 - ATR_FALLBACK_PCT)
    : entry - ATR_STOP_MULTIPLIER * atr14;
  const stopLoss = Math.max(rawStopLoss, entry * 0.5);
  const riskPerShare = entry - stopLoss;

  const targetResistance = resistance && resistance.price > entry ? resistance.price : null;
  const targetForecast = consensusTarget != null && consensusTarget > entry ? consensusTarget : null;
  const target =
    targetResistance != null && (targetForecast == null || targetResistance < targetForecast)
      ? targetResistance
      : targetForecast;
  const targetSource: EntryExitPlan["targetSource"] =
    target == null ? null : target === targetResistance ? "resistance" : "forecast";

  const rewardPerShare = target != null ? target - entry : null;
  const riskRewardRatio =
    rewardPerShare != null && riskPerShare > 0 ? rewardPerShare / riskPerShare : null;

  const stopDesc = atrFallback
    ? `${(ATR_FALLBACK_PCT * 100).toFixed(0)}% below entry (ATR unavailable)`
    : `2x ATR(14) below entry`;
  const targetDesc =
    target == null
      ? "no clear target above entry"
      : targetSource === "resistance"
        ? `nearest resistance ${formatPriceAmount(target)}`
        : `model consensus forecast ${formatPriceAmount(target)}`;
  let rationale = `Entry ${formatPriceAmount(entry)}. Stop-loss set ${stopDesc} at ${formatPriceAmount(stopLoss)}; target set at ${targetDesc}.`;
  if (riskRewardRatio != null && riskRewardRatio < MIN_HEALTHY_RR) {
    rationale += ` Risk/reward below ${MIN_HEALTHY_RR}:1 — a bullish signal doesn't guarantee a favorable trade setup.`;
  }

  return {
    entry,
    stopLoss,
    target,
    riskPerShare,
    rewardPerShare,
    riskRewardRatio,
    atrUsed: atrFallback ? null : atr14,
    atrFallback,
    support,
    resistance,
    targetSource,
    rationale,
  };
}
