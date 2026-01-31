"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Link2, CheckCircle2, AlertCircle, HelpCircle, XCircle } from "lucide-react";

interface Match {
  pickId: number;
  pickName: string;
  year: number;
  matchedPlayerId: number | null;
  matchedPlayerName: string | null;
  matchedPosition: string | null;
  confidence: "exact" | "high" | "medium" | "low" | "none";
  similarityScore: number;
}

interface Stats {
  total: number;
  exact: number;
  high: number;
  medium: number;
  low: number;
  none: number;
}

const CONFIDENCE_CONFIG = {
  exact: {
    label: "Exact",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  high: {
    label: "High",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: CheckCircle2,
    iconColor: "text-blue-500",
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: HelpCircle,
    iconColor: "text-yellow-500",
  },
  low: {
    label: "Low",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: AlertCircle,
    iconColor: "text-orange-500",
  },
  none: {
    label: "No Match",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  WR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RB: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  TE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function LinkRookieDraftAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  const fetchMatches = async () => {
    try {
      const response = await fetch("/api/admin/link-rookie-draft");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setMatches(data.matches);
      setStats(data.stats);

      // Auto-select exact and high confidence matches
      const autoSelect = new Set<number>();
      for (const match of data.matches) {
        if (
          match.matchedPlayerId &&
          (match.confidence === "exact" || match.confidence === "high")
        ) {
          autoSelect.add(match.pickId);
        }
      }
      setSelectedMatches(autoSelect);
    } catch {
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const toggleMatch = (pickId: number) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(pickId)) {
      newSelected.delete(pickId);
    } else {
      newSelected.add(pickId);
    }
    setSelectedMatches(newSelected);
  };

  const selectAll = (confidence: Match["confidence"]) => {
    const newSelected = new Set(selectedMatches);
    for (const match of matches) {
      if (match.confidence === confidence && match.matchedPlayerId) {
        newSelected.add(match.pickId);
      }
    }
    setSelectedMatches(newSelected);
  };

  const deselectAll = (confidence: Match["confidence"]) => {
    const newSelected = new Set(selectedMatches);
    for (const match of matches) {
      if (match.confidence === confidence) {
        newSelected.delete(match.pickId);
      }
    }
    setSelectedMatches(newSelected);
  };

  const applyMatches = async () => {
    const toApply = matches
      .filter((m) => selectedMatches.has(m.pickId) && m.matchedPlayerId)
      .map((m) => ({
        pickId: m.pickId,
        playerId: m.matchedPlayerId!,
      }));

    if (toApply.length === 0) {
      toast.error("No matches selected");
      return;
    }

    setApplying(true);
    try {
      const response = await fetch("/api/admin/link-rookie-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: toApply }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to apply matches");
      }

      toast.success(`Linked ${result.updated} players successfully!`);
      router.refresh();
      await fetchMatches(); // Refresh the list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Analyzing matches...
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-medium">All Done!</p>
          <p className="text-muted-foreground">
            All rookie draft picks are already linked to the player registry.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Unlinked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          {(["exact", "high", "medium", "low", "none"] as const).map((conf) => {
            const config = CONFIDENCE_CONFIG[conf];
            const Icon = config.icon;
            return (
              <Card key={conf}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats[conf]}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Match Results
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedMatches.size} selected
              </Badge>
              <Button
                onClick={applyMatches}
                disabled={applying || selectedMatches.size === 0}
              >
                {applying ? "Linking..." : `Link ${selectedMatches.size} Players`}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Review matches and select which ones to apply. Exact and high-confidence matches are pre-selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
            {(["exact", "high", "medium", "low"] as const).map((conf) => (
              <div key={conf} className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAll(conf)}
                >
                  All {CONFIDENCE_CONFIG[conf].label}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMatches(new Set())}
            >
              Clear All
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Draft Pick Name</TableHead>
                  <TableHead className="w-16">Year</TableHead>
                  <TableHead>Matched Player</TableHead>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead className="w-24">Confidence</TableHead>
                  <TableHead className="w-20 text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const config = CONFIDENCE_CONFIG[match.confidence];
                  const Icon = config.icon;
                  const isSelected = selectedMatches.has(match.pickId);
                  const canSelect = match.matchedPlayerId !== null;

                  return (
                    <TableRow
                      key={match.pickId}
                      className={isSelected ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMatch(match.pickId)}
                          disabled={!canSelect}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {match.pickName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {match.year}
                      </TableCell>
                      <TableCell>
                        {match.matchedPlayerName ? (
                          <span
                            className={
                              match.pickName !== match.matchedPlayerName
                                ? "text-amber-600 dark:text-amber-400"
                                : ""
                            }
                          >
                            {match.matchedPlayerName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            No match found
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.matchedPosition && (
                          <Badge
                            variant="outline"
                            className={POSITION_COLORS[match.matchedPosition] || ""}
                          >
                            {match.matchedPosition}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.color}>
                          <Icon className={`h-3 w-3 mr-1 ${config.iconColor}`} />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {match.similarityScore > 0
                          ? `${Math.round(match.similarityScore * 100)}%`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
