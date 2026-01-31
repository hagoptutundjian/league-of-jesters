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
import { Trophy, ArrowRightLeft, ChevronDown, ChevronUp } from "lucide-react";

interface LeaderboardEntry {
  teamId: number;
  teamName: string;
  teamAbbr: string;
  tradeCount: number;
}

interface TradeLeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  icon: "trophy" | "arrows";
  accentColor: "yellow" | "blue";
}

export function TradeLeaderboard({
  title,
  entries,
  icon,
  accentColor,
}: TradeLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);
  const DEFAULT_SHOW = 5;

  const displayedEntries = expanded ? entries : entries.slice(0, DEFAULT_SHOW);
  const hasMore = entries.length > DEFAULT_SHOW;

  const getPositionColor = (index: number) => {
    if (accentColor === "yellow") {
      if (index === 0) return "text-yellow-500";
      if (index === 1) return "text-gray-400";
      if (index === 2) return "text-amber-600";
    } else {
      if (index === 0) return "text-blue-500";
    }
    return "text-muted-foreground";
  };

  const IconComponent = icon === "trophy" ? Trophy : ArrowRightLeft;
  const iconColor = accentColor === "yellow" ? "text-yellow-500" : "text-blue-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <IconComponent className={`h-4 w-4 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length > 0 ? (
          <div className="space-y-1">
            {displayedEntries.map((entry, index) => (
              <div
                key={entry.teamId}
                className="flex items-center justify-between text-sm py-1"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold w-5 ${getPositionColor(index)}`}>
                    {index + 1}.
                  </span>
                  <span className="font-medium">{entry.teamName}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {entry.tradeCount}
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
        ) : (
          <p className="text-sm text-muted-foreground py-2">No trades this season</p>
        )}
      </CardContent>
    </Card>
  );
}
