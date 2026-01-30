import { db } from "@/lib/db";
import { rookieDraftHistory, teams } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RookieDraftTable } from "@/components/rookie-draft-table";
import { ImportRookieDraft } from "@/components/import-rookie-draft";
import { AddDraftPick } from "@/components/add-draft-pick";

export const dynamic = "force-dynamic";

async function getDraftHistory() {
  const results = await db
    .select({
      id: rookieDraftHistory.id,
      year: rookieDraftHistory.year,
      round: rookieDraftHistory.round,
      pick: rookieDraftHistory.pick,
      overallPick: rookieDraftHistory.overallPick,
      playerName: rookieDraftHistory.playerName,
      teamId: rookieDraftHistory.teamId,
      teamName: teams.name,
      teamAbbreviation: teams.abbreviation,
    })
    .from(rookieDraftHistory)
    .innerJoin(teams, eq(rookieDraftHistory.teamId, teams.id))
    .orderBy(desc(rookieDraftHistory.year), rookieDraftHistory.round, rookieDraftHistory.pick);

  return results;
}

async function getAllTeams() {
  return db
    .select({ id: teams.id, name: teams.name, abbreviation: teams.abbreviation })
    .from(teams)
    .orderBy(teams.name);
}

async function getDraftYears() {
  const results = await db
    .selectDistinct({ year: rookieDraftHistory.year })
    .from(rookieDraftHistory)
    .orderBy(desc(rookieDraftHistory.year));
  return results.map((r) => r.year);
}

export default async function RookieDraftPage() {
  const [draftHistory, allTeams, draftYears] = await Promise.all([
    getDraftHistory(),
    getAllTeams(),
    getDraftYears(),
  ]);
  const commissioner = await isCommissioner();

  // Calculate stats
  const picksByTeam = allTeams.map((team) => ({
    ...team,
    totalPicks: draftHistory.filter((d) => d.teamId === team.id).length,
    firstRoundPicks: draftHistory.filter(
      (d) => d.teamId === team.id && d.round === 1
    ).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rookie Draft</h1>
          <p className="text-muted-foreground">
            View historical rookie draft picks by year and team
          </p>
        </div>
        {commissioner && (
          <div className="flex gap-2">
            <AddDraftPick teams={allTeams} existingYears={draftYears} />
            <ImportRookieDraft teams={allTeams} />
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftYears.length}</div>
            <p className="text-xs text-muted-foreground">
              {draftYears.length > 0
                ? `${Math.min(...draftYears)} - ${Math.max(...draftYears)}`
                : "No drafts yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftHistory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              First Round Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {draftHistory.filter((d) => d.round === 1).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {picksByTeam.length > 0 && picksByTeam.some((t) => t.totalPicks > 0) ? (
              <>
                <div className="text-2xl font-bold">
                  {Math.max(...picksByTeam.map((t) => t.totalPicks))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {picksByTeam.find(
                    (t) => t.totalPicks === Math.max(...picksByTeam.map((t) => t.totalPicks))
                  )?.name || ""}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Draft history table with filters */}
      <Card>
        <CardHeader>
          <CardTitle>Draft History</CardTitle>
          <CardDescription>
            Search and filter all rookie draft picks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RookieDraftTable
            draftHistory={draftHistory}
            years={draftYears}
            teams={allTeams}
            isCommissioner={commissioner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
