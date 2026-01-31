import { db } from "@/lib/db";
import { freeAgentAuctionHistory, teams, leagueSettings } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gavel, Settings } from "lucide-react";
import { FreeAgentAuctionTable } from "@/components/free-agent-auction-table";

export const dynamic = "force-dynamic";

const POSITION_ORDER = ["QB", "WR", "RB", "TE"];

async function getAuctionHistory() {
  const results = await db
    .select({
      id: freeAgentAuctionHistory.id,
      year: freeAgentAuctionHistory.year,
      pickOrder: freeAgentAuctionHistory.pickOrder,
      playerName: freeAgentAuctionHistory.playerName,
      position: freeAgentAuctionHistory.position,
      salary: freeAgentAuctionHistory.salary,
      teamId: freeAgentAuctionHistory.teamId,
      teamName: teams.name,
      teamAbbr: teams.abbreviation,
      createdAt: freeAgentAuctionHistory.createdAt,
    })
    .from(freeAgentAuctionHistory)
    .innerJoin(teams, eq(freeAgentAuctionHistory.teamId, teams.id))
    .orderBy(desc(freeAgentAuctionHistory.year), freeAgentAuctionHistory.pickOrder);

  return results;
}

async function getAuctionYears() {
  const results = await db
    .selectDistinct({ year: freeAgentAuctionHistory.year })
    .from(freeAgentAuctionHistory)
    .orderBy(desc(freeAgentAuctionHistory.year));
  return results.map((r) => r.year);
}

async function getAllTeams() {
  return db
    .select({ id: teams.id, name: teams.name, abbreviation: teams.abbreviation })
    .from(teams)
    .orderBy(teams.name);
}

export default async function FreeAgentAuctionPage() {
  const [auctionHistory, auctionYears, allTeams] = await Promise.all([
    getAuctionHistory(),
    getAuctionYears(),
    getAllTeams(),
  ]);
  const commissioner = await isCommissioner();

  // Calculate stats
  const totalSpent = auctionHistory.reduce(
    (sum, pick) => sum + Number(pick.salary),
    0
  );

  // Position breakdown
  const positionTotals: Record<string, number> = {};
  const positionSpending: Record<string, number> = {};
  for (const pick of auctionHistory) {
    const pos = pick.position || "Unknown";
    positionTotals[pos] = (positionTotals[pos] || 0) + 1;
    positionSpending[pos] = (positionSpending[pos] || 0) + Number(pick.salary);
  }

  // Top spenders by team
  const teamSpending: Record<number, { name: string; abbr: string; spent: number; count: number }> = {};
  for (const pick of auctionHistory) {
    if (!teamSpending[pick.teamId]) {
      teamSpending[pick.teamId] = {
        name: pick.teamName,
        abbr: pick.teamAbbr,
        spent: 0,
        count: 0,
      };
    }
    teamSpending[pick.teamId].spent += Number(pick.salary);
    teamSpending[pick.teamId].count += 1;
  }
  const topSpenders = Object.values(teamSpending)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Free Agent Auction</h1>
          <p className="text-muted-foreground">
            Historical free agent auction results
          </p>
        </div>
        {commissioner && (
          <Button asChild>
            <Link href="/admin/free-agent-auction">
              <Settings className="h-4 w-4 mr-2" />
              Run Auction
            </Link>
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Auctions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auctionYears.length}</div>
            <p className="text-xs text-muted-foreground">
              {auctionYears.length > 0
                ? `${Math.min(...auctionYears)} - ${Math.max(...auctionYears)}`
                : "No auctions yet"}
            </p>
            <div className="text-lg font-semibold mt-2">
              {auctionHistory.length} players drafted
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg: $
              {auctionHistory.length > 0
                ? Math.round(totalSpent / auctionHistory.length).toLocaleString()
                : 0}
              /player
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gavel className="h-4 w-4 text-amber-500" />
              Position Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {POSITION_ORDER.map((pos) => {
                const count = positionTotals[pos] || 0;
                const spent = positionSpending[pos] || 0;
                if (count === 0) return null;
                return (
                  <div key={pos} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pos}</span>
                    <span className="text-muted-foreground">
                      {count} (${Math.round(spent).toLocaleString()})
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Spenders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSpenders.length > 0 ? (
              <div className="space-y-1">
                {topSpenders.slice(0, 3).map((team, i) => (
                  <div key={team.abbr} className="flex items-center justify-between text-sm">
                    <span className={i === 0 ? "font-medium" : ""}>{team.abbr}</span>
                    <span className={`font-mono ${i === 0 ? "font-bold" : "text-muted-foreground"}`}>
                      ${Math.round(team.spent).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auction history table */}
      <Card>
        <CardHeader>
          <CardTitle>Auction History</CardTitle>
          <CardDescription>
            Search and filter all free agent auction picks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FreeAgentAuctionTable
            auctionHistory={auctionHistory}
            years={auctionYears}
            teams={allTeams}
          />
        </CardContent>
      </Card>
    </div>
  );
}
