import type { SignalAction } from "@/lib/signal/types";

export const SIGNAL_ACTIONS: SignalAction[] = ["buy", "hold", "avoid"];

export function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatHitRate(value: number | null): string {
  return value != null ? `${value.toFixed(0)}%` : "—";
}
