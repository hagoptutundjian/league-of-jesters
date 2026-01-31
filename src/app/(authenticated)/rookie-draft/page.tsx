import { db } from "@/lib/db";
import { rookieDraftHistory, teams, players } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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
import { DraftPicksLeaderboard } from "@/components/draft-picks-leaderboard";
import { PositionBreakdownCard } from "@/components/position-breakdown-card";

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
      position: players.position,
    })
    .from(rookieDraftHistory)
    .innerJoin(teams, eq(rookieDraftHistory.teamId, teams.id))
    .leftJoin(players, eq(rookieDraftHistory.playerId, players.id))
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
  }));

  // Top 6 most picks (descending)
  const topPickers = [...picksByTeam]
    .filter((t) => t.totalPicks > 0)
    .sort((a, b) => b.totalPicks - a.totalPicks)
    .slice(0, 6);

  // Bottom 6 least picks (ascending)
  const bottomPickers = [...picksByTeam]
    .filter((t) => t.totalPicks > 0)
    .sort((a, b) => a.totalPicks - b.totalPicks)
    .slice(0, 6);

  // Position breakdown by round
  const positionByRound: Record<number, Record<string, number>> = {};
  const positionTotals: Record<string, number> = {};
  const positionOrder = ["QB", "WR", "RB", "TE"];

  for (const pick of draftHistory) {
    const pos = pick.position || "Unknown";
    // Total counts
    positionTotals[pos] = (positionTotals[pos] || 0) + 1;
    // By round
    if (!positionByRound[pick.round]) {
      positionByRound[pick.round] = {};
    }
    positionByRound[pick.round][pos] = (positionByRound[pick.round][pos] || 0) + 1;
  }

  const rounds = Object.keys(positionByRound).map(Number).sort((a, b) => a - b);

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
            <div className="text-lg font-semibold mt-2">{draftHistory.length} picks</div>
          </CardContent>
        </Card>
        <PositionBreakdownCard
          positionTotals={positionTotals}
          positionByRound={positionByRound}
          rounds={rounds}
          positionOrder={positionOrder}
        />
        <DraftPicksLeaderboard
          title="Most Picks"
          entries={topPickers}
          type="most"
        />
        <DraftPicksLeaderboard
          title="Least Picks"
          entries={bottomPickers}
          type="least"
        />
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
