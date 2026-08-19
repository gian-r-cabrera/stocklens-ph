import type { BaselineModel } from "@/lib/forecast/types";
import type { SwingLevel } from "@/lib/market/indicators";

export type SignalAction = "buy" | "hold" | "avoid";

export type ModelVote = {
  model: BaselineModel;
  direction: -1 | 0 | 1;
  weight: number;
  dirAccuracy: number | null;
  forecastPrice: number;
};

export type ConsensusSignal = {
  action: SignalAction;
  score: number;
  confidence: number;
  votes: ModelVote[];
  horizonDays: number;
  fallback: boolean;
  dataSufficient: boolean;
  rationale: string;
};

export type EntryExitPlan = {
  entry: number;
  stopLoss: number;
  target: number | null;
  riskPerShare: number;
  rewardPerShare: number | null;
  riskRewardRatio: number | null;
  atrUsed: number | null;
  atrFallback: boolean;
  support: SwingLevel | null;
  resistance: SwingLevel | null;
  targetSource: "resistance" | "forecast" | null;
  rationale: string;
};
