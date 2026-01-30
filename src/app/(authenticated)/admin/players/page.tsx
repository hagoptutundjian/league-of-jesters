import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contracts, players, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateSalary } from "@/lib/salary/engine";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditPlayerButton } from "@/components/edit-player-button";
import { DeletePlayerButton } from "@/components/delete-player-button";
import { AddPlayerAdmin } from "@/components/add-player-admin";
import { getPositionColor } from "@/lib/position-colors";

export const dynamic = "force-dynamic";

async function getAllContracts() {
  const results = await db
    .select({
      contractId: contracts.id,
      playerId: players.id,
      playerName: players.name,
      position: players.position,
      salary2025: contracts.salary2025,
      yearAcquired: contracts.yearAcquired,
      acquisitionType: contracts.acquisitionType,
      rosterStatus: contracts.rosterStatus,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .innerJoin(teams, eq(contracts.teamId, teams.id))
    .where(eq(contracts.isActive, true))
    .orderBy(teams.name, players.name);

  return results.map((r) => ({
    ...r,
    salary2025: Number(r.salary2025),
    salary2025Calc: calculateSalary(Number(r.salary2025), r.yearAcquired, 2025),
  }));
}

async function getAllTeams() {
  return db.select({ id: teams.id, name: teams.name, slug: teams.slug }).from(teams).orderBy(teams.name);
}

export default async function AdminPlayersPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const allContracts = await getAllContracts();
  const allTeams = await getAllTeams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Player Management</h1>
        <p className="text-muted-foreground">
          Add, edit, and manage all players and their contract details
        </p>
      </div>

      <AddPlayerAdmin teams={allTeams} />

      <Card>
        <CardHeader>
          <CardTitle>All Players ({allContracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Year Acq</TableHead>
                  <TableHead className="text-right">2025 $</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allContracts.map((c) => (
                  <TableRow key={c.contractId}>
                    <TableCell className="font-medium">{c.playerName}</TableCell>
                    <TableCell>
                      {c.position ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPositionColor(c.position).badge}`}>
                          {c.position}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{c.teamName}</TableCell>
                    <TableCell>
                      {c.rosterStatus === "practice_squad" && (
                        <Badge variant="outline">PS</Badge>
                      )}
                      {c.rosterStatus === "injured_reserve" && (
                        <Badge variant="destructive">IR</Badge>
                      )}
                      {c.rosterStatus === "active" && (
                        <span className="text-xs text-muted-foreground">Active</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{c.yearAcquired}</TableCell>
                    <TableCell className="text-right">${c.salary2025}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditPlayerButton
                          contractId={c.contractId}
                          playerName={c.playerName}
                          position={c.position}
                          salary2025={c.salary2025}
                          yearAcquired={c.yearAcquired}
                          rosterStatus={c.rosterStatus}
                          teamId={c.teamId}
                          teams={allTeams}
                        />
                        <DeletePlayerButton
                          contractId={c.contractId}
                          playerName={c.playerName}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {allContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No players in the system yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
