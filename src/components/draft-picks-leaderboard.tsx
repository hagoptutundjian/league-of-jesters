"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";

interface LeaderboardEntry {
  id: number;
  name: string;
  totalPicks: number;
}

interface DraftPicksLeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  type: "most" | "least";
}

export function DraftPicksLeaderboard({
  title,
  entries,
  type,
}: DraftPicksLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);
  const DEFAULT_SHOW = 3;

  const displayedEntries = expanded ? entries : entries.slice(0, DEFAULT_SHOW);
  const hasMore = entries.length > DEFAULT_SHOW;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {type === "most" ? (
            <Trophy className="h-4 w-4 text-yellow-500" />
          ) : (
            <span className="text-base">🤡</span>
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <div className="space-y-1">
            {displayedEntries.map((team, index) => (
              <div key={team.id} className="flex items-center justify-between text-sm">
                <span className={index === 0 ? "font-medium" : ""}>{team.name}</span>
                <span className={`font-mono ${index === 0 ? "font-bold" : "text-muted-foreground"}`}>
                  {team.totalPicks}
                </span>
              </div>
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 text-xs text-muted-foreground hover:text-foreground h-6 px-2"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    +{entries.length - DEFAULT_SHOW} more
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-2xl font-bold">-</div>
        )}
      </CardContent>
    </Card>
  );
}
