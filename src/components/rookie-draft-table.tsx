"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DraftPick {
  id: number;
  year: number;
  round: number;
  pick: number;
  overallPick: string;
  playerName: string;
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface RookieDraftTableProps {
  draftHistory: DraftPick[];
  years: number[];
  teams: Team[];
}

export function RookieDraftTable({
  draftHistory,
  years,
  teams,
}: RookieDraftTableProps) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get unique rounds from the data
  const rounds = useMemo(() => {
    const uniqueRounds = [...new Set(draftHistory.map((d) => d.round))];
    return uniqueRounds.sort((a, b) => a - b);
  }, [draftHistory]);

  // Filter the draft history
  const filteredHistory = useMemo(() => {
    return draftHistory.filter((pick) => {
      // Year filter
      if (yearFilter !== "all" && pick.year !== parseInt(yearFilter)) {
        return false;
      }
      // Team filter
      if (teamFilter !== "all" && pick.teamId !== parseInt(teamFilter)) {
        return false;
      }
      // Round filter
      if (roundFilter !== "all" && pick.round !== parseInt(roundFilter)) {
        return false;
      }
      // Search query (player name)
      if (
        searchQuery &&
        !pick.playerName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [draftHistory, yearFilter, teamFilter, roundFilter, searchQuery]);

  // Group by year for display
  const groupedByYear = useMemo(() => {
    const grouped: Record<number, DraftPick[]> = {};
    filteredHistory.forEach((pick) => {
      if (!grouped[pick.year]) {
        grouped[pick.year] = [];
      }
      grouped[pick.year].push(pick);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([year, picks]) => ({
        year: parseInt(year),
        picks: picks.sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.pick - b.pick;
        }),
      }));
  }, [filteredHistory]);

  const getRoundBadgeColor = (round: number) => {
    switch (round) {
      case 1:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case 2:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
      case 3:
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case 4:
        return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <Input
            placeholder="Search player..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id.toString()}>
                {team.abbreviation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roundFilter} onValueChange={setRoundFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rounds</SelectItem>
            {rounds.map((round) => (
              <SelectItem key={round} value={round.toString()}>
                Round {round}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredHistory.length} of {draftHistory.length} picks
      </p>

      {/* Table */}
      {groupedByYear.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {draftHistory.length === 0
            ? "No draft history yet. Import draft data to get started."
            : "No picks match your filters."}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByYear.map(({ year, picks }) => (
            <div key={year}>
              <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-background py-2">
                {year} Rookie Draft
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({picks.length} picks)
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Pick</TableHead>
                      <TableHead className="w-20">Round</TableHead>
                      <TableHead className="w-32">Team</TableHead>
                      <TableHead>Player</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picks.map((pick, index) => (
                      <TableRow
                        key={pick.id}
                        className="row-hover animate-fade-in"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <TableCell className="font-mono font-medium">
                          {pick.overallPick}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getRoundBadgeColor(
                              pick.round
                            )}`}
                          >
                            R{pick.round}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {pick.teamAbbreviation}
                        </TableCell>
                        <TableCell>{pick.playerName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
