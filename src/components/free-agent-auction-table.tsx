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

interface AuctionPick {
  id: number;
  year: number;
  pickOrder: number;
  playerName: string;
  position: string | null;
  salary: string;
  teamId: number;
  teamName: string;
  teamAbbr: string;
  createdAt: Date;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface FreeAgentAuctionTableProps {
  auctionHistory: AuctionPick[];
  years: number[];
  teams: Team[];
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  WR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RB: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  TE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function FreeAgentAuctionTable({
  auctionHistory,
  years,
  teams,
}: FreeAgentAuctionTableProps) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const positions = useMemo(() => {
    const uniquePositions = [
      ...new Set(auctionHistory.map((p) => p.position).filter(Boolean)),
    ] as string[];
    return uniquePositions.sort();
  }, [auctionHistory]);

  const filteredHistory = useMemo(() => {
    return auctionHistory.filter((pick) => {
      if (yearFilter !== "all" && pick.year !== parseInt(yearFilter)) {
        return false;
      }
      if (teamFilter !== "all" && pick.teamId !== parseInt(teamFilter)) {
        return false;
      }
      if (positionFilter !== "all" && pick.position !== positionFilter) {
        return false;
      }
      if (
        searchQuery &&
        !pick.playerName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [auctionHistory, yearFilter, teamFilter, positionFilter, searchQuery]);

  // Group by year for display
  const groupedByYear = useMemo(() => {
    const grouped: Record<number, AuctionPick[]> = {};
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
        picks: picks.sort((a, b) => a.pickOrder - b.pickOrder),
        totalSpent: picks.reduce((sum, p) => sum + Number(p.salary), 0),
      }));
  }, [filteredHistory]);

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
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {positions.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredHistory.length} of {auctionHistory.length} picks
      </p>

      {/* Table */}
      {groupedByYear.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {auctionHistory.length === 0
            ? "No auction history yet."
            : "No picks match your filters."}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByYear.map(({ year, picks, totalSpent }) => (
            <div key={year}>
              <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-background py-2 flex items-center justify-between">
                <span>
                  {year} Free Agent Auction
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({picks.length} picks)
                  </span>
                </span>
                <span className="text-sm font-medium">
                  Total: ${Math.round(totalSpent).toLocaleString()}
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead className="w-32">Team</TableHead>
                      <TableHead className="w-24 text-right">Salary</TableHead>
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
                          {pick.pickOrder}
                        </TableCell>
                        <TableCell className="font-medium">
                          {pick.playerName}
                        </TableCell>
                        <TableCell>
                          {pick.position && (
                            <Badge
                              variant="outline"
                              className={POSITION_COLORS[pick.position] || ""}
                            >
                              {pick.position}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{pick.teamName}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${Number(pick.salary).toLocaleString()}
                        </TableCell>
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
