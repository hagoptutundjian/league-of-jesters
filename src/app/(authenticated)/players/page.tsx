import { db } from "@/lib/db";
import { players, contracts, teams } from "@/lib/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { calculateSalary, calculateCapHit } from "@/lib/salary/engine";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PlayerSearch } from "@/components/player-search";
import { getPositionColor } from "@/lib/position-colors";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; pos?: string }>;
}

async function getAllPlayers(search?: string, position?: string) {
  // Get all active contracts with player and team info
  const query = db
    .select({
      playerId: players.id,
      playerName: players.name,
      position: players.position,
      nflTeam: players.nflTeam,
      contractId: contracts.id,
      salary2025: contracts.salary2025,
      yearAcquired: contracts.yearAcquired,
      rosterStatus: contracts.rosterStatus,
      acquisitionType: contracts.acquisitionType,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .innerJoin(teams, eq(contracts.teamId, teams.id))
    .where(eq(contracts.isActive, true))
    .orderBy(players.name);

  const results = await query;

  // Apply search filter in JS (simpler than dynamic SQL)
  let filtered = results;
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.playerName.toLowerCase().includes(searchLower) ||
        r.teamName.toLowerCase().includes(searchLower)
    );
  }
  if (position) {
    filtered = filtered.filter((r) => r.position === position);
  }

  return filtered.map((r) => ({
    ...r,
    salary2025Val: calculateSalary(Number(r.salary2025), r.yearAcquired, 2025),
    capHit2025: calculateCapHit(
      calculateSalary(Number(r.salary2025), r.yearAcquired, 2025),
      r.rosterStatus
    ),
  }));
}

export default async function PlayersPage({ searchParams }: PageProps) {
  const { q, pos } = await searchParams;
  const allPlayers = await getAllPlayers(q, pos);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Player Directory</h1>
        <p className="text-muted-foreground">
          All rostered players across the league
        </p>
      </div>

      <PlayerSearch initialSearch={q} initialPosition={pos} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Yr Acq</TableHead>
              <TableHead className="text-right">2025 Salary</TableHead>
              <TableHead className="text-right">Cap Hit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allPlayers.map((p) => (
              <TableRow key={p.contractId}>
                <TableCell className="font-medium">{p.playerName}</TableCell>
                <TableCell>
                  {p.position ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPositionColor(p.position).badge}`}>
                      {p.position}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/teams/${p.teamSlug}`}
                    className="hover:underline"
                  >
                    {p.teamName}
                  </Link>
                </TableCell>
                <TableCell>
                  {p.rosterStatus === "practice_squad" && (
                    <Badge variant="outline">PS</Badge>
                  )}
                  {p.rosterStatus === "injured_reserve" && (
                    <Badge variant="destructive">IR</Badge>
                  )}
                  {p.rosterStatus === "active" && (
                    <span className="text-sm text-muted-foreground">Active</span>
                  )}
                </TableCell>
                <TableCell className="text-center">{p.yearAcquired}</TableCell>
                <TableCell className="text-right">${p.salary2025Val}</TableCell>
                <TableCell className="text-right">${p.capHit2025}</TableCell>
              </TableRow>
            ))}
            {allPlayers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No players found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        {allPlayers.length} players total
      </p>
    </div>
  );
}
