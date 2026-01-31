"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Handshake } from "lucide-react";

interface TradePartnerEntry {
  team1Name: string;
  team1Abbr: string;
  team2Name: string;
  team2Abbr: string;
  tradeCount: number;
}

interface TradePartnersLeaderboardProps {
  entries: TradePartnerEntry[];
}

export function TradePartnersLeaderboard({ entries }: TradePartnersLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);
  const DEFAULT_SHOW = 5;

  const displayedEntries = expanded ? entries : entries.slice(0, DEFAULT_SHOW);
  const hasMore = entries.length > DEFAULT_SHOW;

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Handshake className="h-4 w-4 text-green-500" />
          Most Common Trade Partners
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {displayedEntries.map((entry, index) => (
            <div
              key={`${entry.team1Abbr}-${entry.team2Abbr}`}
              className="flex items-center justify-between text-sm py-1"
            >
              <div className="flex items-center gap-2">
                <span className={`font-bold w-5 ${index === 0 ? "text-green-500" : "text-muted-foreground"}`}>
                  {index + 1}.
                </span>
                <span className="font-medium">
                  {entry.team1Name} <span className="text-muted-foreground mx-1">↔</span> {entry.team2Name}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {entry.tradeCount} {entry.tradeCount === 1 ? "trade" : "trades"}
              </Badge>
            </div>
          ))}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show all {entries.length}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
