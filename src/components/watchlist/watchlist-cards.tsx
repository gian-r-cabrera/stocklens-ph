"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WatchlistStock } from "@/lib/data/watchlist";
import { directionFromChangeString } from "@/lib/market/change-direction";
import { PriceChange, PriceDirectionIcon } from "@/components/ui/price-change";
import { SignalBadge } from "@/components/ui/signal-badge";
import { TrendBadge } from "@/components/ui/trend-badge";
import { tickerToPath } from "@/lib/forecast";
import { useWatchlistStore } from "@/lib/stores/watchlist-store";

function WatchlistCard({ stock }: { stock: WatchlistStock }) {
  const removeStock = useWatchlistStore((s) => s.removeStock);
  const addStock = useWatchlistStore((s) => s.addStock);

  const handleRemove = () => {
    removeStock(stock.ticker);
    toast.message(`Removed ${stock.ticker} from watchlist.`, {
      action: {
        label: "Undo",
        onClick: () => addStock(stock.ticker),
      },
    });
  };

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <WatchlistCardMeta stock={stock} />
          <div className="flex items-center gap-1">
            <PriceDirectionIcon
              direction={directionFromChangeString(stock.change)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              aria-label={`Remove ${stock.ticker} from watchlist`}
              onClick={handleRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-end justify-between">
          <span className="tabular-nums text-2xl font-semibold">{stock.price}</span>
          <PriceChange change={stock.change} className="text-sm" />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Trend:</span>
              <TrendBadge trend={stock.trend} className="text-xs" />
            </div>
            {stock.signal != null ? (
              <SignalBadge action={stock.signal} className="text-xs" />
            ) : null}
          </div>
          <Link href={`/stock/${tickerToPath(stock.ticker)}`}>
            <Button variant="ghost" size="sm" className="h-7">
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function WatchlistCardMeta({ stock }: { stock: WatchlistStock }) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center gap-2">
        <CardTitle className="text-base">{stock.ticker}</CardTitle>
        <Badge variant="outline" className="text-xs">
          {stock.sector}
        </Badge>
      </div>
      <CardDescription className="text-xs">{stock.name}</CardDescription>
    </div>
  );
}

export function WatchlistCards() {
  const stocks = useWatchlistStore((s) => s.stocks);
  return (
    <div className="grid gap-4 md:hidden">
      {stocks.map((stock) => (
        <WatchlistCard key={stock.ticker} stock={stock} />
      ))}
    </div>
  );
}
