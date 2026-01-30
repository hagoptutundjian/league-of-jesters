import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { draftPicks, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
import { AddDraftPickForm } from "@/components/add-draft-pick-form";
import { EditDraftPickButton } from "@/components/edit-draft-pick-button";

export const dynamic = "force-dynamic";

async function getAllDraftPicks() {
  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  const picks = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.isUsed, false))
    .orderBy(draftPicks.year, draftPicks.round, draftPicks.originalTeamId);

  return picks.map((p) => ({
    ...p,
    originalTeam: teamMap.get(p.originalTeamId),
    currentTeam: teamMap.get(p.currentTeamId),
  }));
}

async function getAllTeams() {
  return db.select({ id: teams.id, name: teams.name, slug: teams.slug }).from(teams).orderBy(teams.name);
}

export default async function AdminDraftPicksPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const allPicks = await getAllDraftPicks();
  const allTeams = await getAllTeams();

  // Group by year
  const picksByYear = new Map<number, typeof allPicks>();
  for (const pick of allPicks) {
    if (!picksByYear.has(pick.year)) {
      picksByYear.set(pick.year, []);
    }
    picksByYear.get(pick.year)!.push(pick);
  }

  const years = Array.from(picksByYear.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Draft Pick Management</h1>
        <p className="text-muted-foreground">
          Add and manage draft picks, including traded picks
        </p>
      </div>

      <AddDraftPickForm teams={allTeams} />

      {years.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No draft picks in the system yet. Add picks above.
          </CardContent>
        </Card>
      ) : (
        years.map((year) => (
          <Card key={year}>
            <CardHeader>
              <CardTitle>{year} Draft Picks</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Original Team</TableHead>
                    <TableHead>Current Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {picksByYear.get(year)!.map((pick) => (
                    <TableRow key={pick.id}>
                      <TableCell className="font-medium">
                        Round {pick.round}
                        {pick.pickNumber && ` (#${pick.pickNumber})`}
                      </TableCell>
                      <TableCell>{pick.originalTeam?.name || "Unknown"}</TableCell>
                      <TableCell>
                        {pick.currentTeam?.name || "Unknown"}
                        {pick.currentTeamId !== pick.originalTeamId && (
                          <Badge variant="secondary" className="ml-2">
                            Traded
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {pick.isUsed ? (
                          <Badge variant="outline">Used</Badge>
                        ) : (
                          <Badge variant="default">Available</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <EditDraftPickButton
                          pickId={pick.id}
                          year={pick.year}
                          round={pick.round}
                          originalTeamId={pick.originalTeamId}
                          currentTeamId={pick.currentTeamId}
                          teams={allTeams}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
