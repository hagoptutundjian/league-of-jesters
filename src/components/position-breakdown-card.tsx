"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

interface PositionBreakdownCardProps {
  positionTotals: Record<string, number>;
  positionByRound: Record<number, Record<string, number>>;
  rounds: number[];
  positionOrder: string[];
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-500",
  WR: "bg-blue-500",
  RB: "bg-green-500",
  TE: "bg-purple-500",
  Unknown: "bg-gray-400",
};

export function PositionBreakdownCard({
  positionTotals,
  positionByRound,
  rounds,
  positionOrder,
}: PositionBreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort positions by order, putting Unknown at the end
  const sortedPositions = Object.keys(positionTotals).sort((a, b) => {
    const aIndex = positionOrder.indexOf(a);
    const bIndex = positionOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const totalPicks = Object.values(positionTotals).reduce((sum, count) => sum + count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          Position Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Totals */}
        <div className="space-y-1 mb-2">
          {sortedPositions.map((pos) => {
            const count = positionTotals[pos];
            const percentage = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
            return (
              <div key={pos} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${POSITION_COLORS[pos] || POSITION_COLORS.Unknown}`} />
                <span className="w-12 font-medium">{pos}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${POSITION_COLORS[pos] || POSITION_COLORS.Unknown}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Expand/Collapse for by-round breakdown */}
        {rounds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-xs text-muted-foreground hover:text-foreground h-6 px-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide by round
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show by round
              </>
            )}
          </Button>
        )}

        {/* By-round breakdown */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {rounds.map((round) => {
              const roundData = positionByRound[round] || {};
              const roundTotal = Object.values(roundData).reduce((sum, count) => sum + count, 0);
              return (
                <div key={round}>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Round {round}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {positionOrder.map((pos) => {
                      const count = roundData[pos] || 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={pos}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white ${POSITION_COLORS[pos]}`}
                        >
                          {pos}: {count}
                        </span>
                      );
                    })}
                    {/* Handle Unknown or other positions */}
                    {Object.entries(roundData)
                      .filter(([pos]) => !positionOrder.includes(pos))
                      .map(([pos, count]) => (
                        <span
                          key={pos}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white bg-gray-400"
                        >
                          {pos}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
