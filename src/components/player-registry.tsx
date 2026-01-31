"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { getPositionColor } from "@/lib/position-colors";

interface PlayerWithSalary {
  playerId: number;
  playerName: string;
  position: string | null;
  salary: number;
  teamName: string;
  teamSlug: string;
  yearAcquired: number;
  salaryYear: number;
}

interface Team {
  slug: string;
  name: string;
}

interface PlayerRegistryProps {
  players: PlayerWithSalary[];
  teams: Team[];
  leagueYear: number;
}

export function PlayerRegistry({ players, teams, leagueYear }: PlayerRegistryProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  const filteredPlayersByPosition = useMemo(() => {
    const filtered = selectedTeam === "all"
      ? players
      : players.filter(p => p.teamSlug === selectedTeam);

    const playersByPosition: Record<string, PlayerWithSalary[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
    };

    for (const player of filtered) {
      if (!player.position) continue;
      playersByPosition[player.position]?.push(player);
    }

    // Sort each position by salary descending
    for (const pos of Object.keys(playersByPosition)) {
      playersByPosition[pos] = playersByPosition[pos].sort((a, b) => b.salary - a.salary);
    }

    return playersByPosition;
  }, [players, selectedTeam]);

  const positions = ["QB", "RB", "WR", "TE"];
  const selectedTeamName = selectedTeam === "all"
    ? null
    : teams.find(t => t.slug === selectedTeam)?.name;

  const totalPlayers = Object.values(filteredPlayersByPosition).flat().length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Registry</h1>
          <p className="text-muted-foreground">
            {selectedTeam === "all"
              ? `All rostered players for ${leagueYear}`
              : `${selectedTeamName}'s roster for ${leagueYear} (${totalPlayers} players)`}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.slug} value={team.slug}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {positions.map((position) => {
          const positionPlayers = filteredPlayersByPosition[position] || [];
          const positionColors = getPositionColor(position);

          return (
            <Card key={position}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${positionColors.badge}`}>
                    {position}
                  </span>
                  <span className="text-lg">
                    {selectedTeam === "all" ? "Top 30" : `${positionPlayers.length} player${positionPlayers.length !== 1 ? "s" : ""}`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedTeam === "all" ? positionPlayers.slice(0, 30) : positionPlayers).map((player, index) => (
                        <TableRow key={player.playerId} className="text-sm">
                          <TableCell className="font-mono text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {player.playerName}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/teams/${player.teamSlug}`}
                              className="text-muted-foreground hover:text-foreground hover:underline"
                            >
                              {player.teamName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${player.salary}
                          </TableCell>
                        </TableRow>
                      ))}
                      {positionPlayers.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-4 text-center text-muted-foreground"
                          >
                            No players found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
