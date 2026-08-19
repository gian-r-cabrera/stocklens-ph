import { Badge } from "@/components/ui/badge";
import type { SignalAction } from "@/lib/signal/types";
import { cn } from "@/lib/utils";

const signalClassName: Record<SignalAction, string> = {
  buy: "border-trend-up/40 bg-trend-up/15 text-trend-up hover:bg-trend-up/20",
  avoid: "border-trend-down/40 bg-trend-down/15 text-trend-down hover:bg-trend-down/20",
  hold: "border-trend-mixed/45 bg-trend-mixed/20 text-trend-mixed hover:bg-trend-mixed/25",
};

const signalLabel: Record<SignalAction, string> = {
  buy: "Buy",
  hold: "Hold",
  avoid: "Avoid",
};

export function SignalBadge({
  action,
  className,
}: {
  action: SignalAction;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(signalClassName[action], className)}>
      {signalLabel[action]}
    </Badge>
  );
}
