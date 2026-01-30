import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants, teams, players, draftPicks } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteTradeButton } from "@/components/delete-trade-button";
import { ImportTrades } from "@/components/import-trades";
import { ArrowRightLeft, Plus, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

interface TradeAssetWithDetails {
  id: number;
  assetType: "player" | "draft_pick";
  description: string | null;
  fromTeamId: number;
  toTeamId: number;
  playerName: string | null;
  fromTeamAbbr: string;
  toTeamAbbr: string;
  draftPickYear: number | null;
  draftPickRound: number | null;
}

interface TradeLeaderboardEntry {
  teamId: number;
  teamName: string;
  teamAbbr: string;
  tradeCount: number;
}

async function getTradesWithDetails() {
  const allTrades = await db
    .select()
    .from(trades)
    .orderBy(desc(trades.tradeDate))
    .limit(200);

  const tradesWithDetails = await Promise.all(
    allTrades.map(async (trade) => {
      // Get participants
      const participantsData = await db
        .select({
          teamId: tradeParticipants.teamId,
          teamName: teams.name,
          teamAbbr: teams.abbreviation,
        })
        .from(tradeParticipants)
        .innerJoin(teams, eq(tradeParticipants.teamId, teams.id))
        .where(eq(tradeParticipants.tradeId, trade.id));

      // Get assets with full details
      const assetsRaw = await db
        .select({
          id: tradeAssets.id,
          assetType: tradeAssets.assetType,
          description: tradeAssets.description,
          fromTeamId: tradeAssets.fromTeamId,
          toTeamId: tradeAssets.toTeamId,
          playerId: tradeAssets.playerId,
          draftPickId: tradeAssets.draftPickId,
        })
        .from(tradeAssets)
        .where(eq(tradeAssets.tradeId, trade.id));

      // Enrich assets with player/pick details
      const assets: TradeAssetWithDetails[] = await Promise.all(
        assetsRaw.map(async (asset) => {
          let playerName: string | null = null;
          let draftPickYear: number | null = null;
          let draftPickRound: number | null = null;

          if (asset.playerId) {
            const player = await db
              .select({ name: players.name })
              .from(players)
              .where(eq(players.id, asset.playerId))
              .limit(1);
            playerName = player[0]?.name || null;
          }

          if (asset.draftPickId) {
            const pick = await db
              .select({ year: draftPicks.year, round: draftPicks.round })
              .from(draftPicks)
              .where(eq(draftPicks.id, asset.draftPickId))
              .limit(1);
            draftPickYear = pick[0]?.year || null;
            draftPickRound = pick[0]?.round || null;
          }

          const fromTeam = participantsData.find((p) => p.teamId === asset.fromTeamId);
          const toTeam = participantsData.find((p) => p.teamId === asset.toTeamId);

          return {
            id: asset.id,
            assetType: asset.assetType,
            description: asset.description,
            fromTeamId: asset.fromTeamId,
            toTeamId: asset.toTeamId,
            playerName,
            fromTeamAbbr: fromTeam?.teamAbbr || "???",
            toTeamAbbr: toTeam?.teamAbbr || "???",
            draftPickYear,
            draftPickRound,
          };
        })
      );

      return {
        ...trade,
        participants: participantsData,
        assets,
      };
    })
  );

  return tradesWithDetails;
}

async function getTradeLeaderboards() {
  // Get current season (assume it's the max season in trades)
  const currentSeasonResult = await db
    .select({ maxSeason: sql<number>`MAX(${trades.season})` })
    .from(trades);
  const currentSeason = currentSeasonResult[0]?.maxSeason || new Date().getFullYear();

  // All-time leaderboard
  const allTimeLeaderboard = await db
    .select({
      teamId: tradeParticipants.teamId,
      teamName: teams.name,
      teamAbbr: teams.abbreviation,
      tradeCount: sql<number>`COUNT(DISTINCT ${tradeParticipants.tradeId})`,
    })
    .from(tradeParticipants)
    .innerJoin(teams, eq(tradeParticipants.teamId, teams.id))
    .groupBy(tradeParticipants.teamId, teams.name, teams.abbreviation)
    .orderBy(desc(sql`COUNT(DISTINCT ${tradeParticipants.tradeId})`))
    .limit(5);

  // Current season leaderboard
  const currentSeasonLeaderboard = await db
    .select({
      teamId: tradeParticipants.teamId,
      teamName: teams.name,
      teamAbbr: teams.abbreviation,
      tradeCount: sql<number>`COUNT(DISTINCT ${tradeParticipants.tradeId})`,
    })
    .from(tradeParticipants)
    .innerJoin(teams, eq(tradeParticipants.teamId, teams.id))
    .innerJoin(trades, eq(tradeParticipants.tradeId, trades.id))
    .where(eq(trades.season, currentSeason))
    .groupBy(tradeParticipants.teamId, teams.name, teams.abbreviation)
    .orderBy(desc(sql`COUNT(DISTINCT ${tradeParticipants.tradeId})`))
    .limit(5);

  return {
    allTime: allTimeLeaderboard as TradeLeaderboardEntry[],
    currentSeason: currentSeasonLeaderboard as TradeLeaderboardEntry[],
    currentSeasonYear: currentSeason,
  };
}

export default async function TradesPage() {
  const [allTrades, commissioner, leaderboards] = await Promise.all([
    getTradesWithDetails(),
    isCommissioner(),
    getTradeLeaderboards(),
  ]);

  // Group by season
  const tradesBySeason = new Map<number, typeof allTrades>();
  for (const trade of allTrades) {
    if (!tradesBySeason.has(trade.season)) {
      tradesBySeason.set(trade.season, []);
    }
    tradesBySeason.get(trade.season)!.push(trade);
  }

  const seasons = Array.from(tradesBySeason.keys()).sort((a, b) => b - a);

  // Group assets by receiving team for cleaner display
  const groupAssetsByReceiver = (assets: TradeAssetWithDetails[]) => {
    const grouped = new Map<number, { abbr: string; assets: TradeAssetWithDetails[] }>();
    for (const asset of assets) {
      if (!grouped.has(asset.toTeamId)) {
        grouped.set(asset.toTeamId, {
          abbr: asset.toTeamAbbr,
          assets: [],
        });
      }
      grouped.get(asset.toTeamId)!.assets.push(asset);
    }
    return Array.from(grouped.values());
  };

  const getAssetDisplay = (asset: TradeAssetWithDetails) => {
    if (asset.assetType === "player" && asset.playerName) {
      return asset.playerName;
    }
    if (asset.assetType === "draft_pick" && asset.draftPickYear && asset.draftPickRound) {
      // Compact format: '25 R1
      return `'${String(asset.draftPickYear).slice(-2)} R${asset.draftPickRound}`;
    }
    // For description-based picks, try to shorten
    if (asset.description) {
      const match = asset.description.match(/(\d{4}).*?(\d+)(?:st|nd|rd|th)?\s*round/i);
      if (match) {
        return `'${match[1].slice(-2)} R${match[2]}`;
      }
      return asset.description;
    }
    return "Unknown";
  };

  const formatCompactDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
          <p className="text-muted-foreground">
            {allTrades.length} trades across {seasons.length} seasons
          </p>
        </div>
        {commissioner && (
          <div className="flex gap-2">
            <ImportTrades />
            <Button asChild>
              <Link href="/trades/new">
                <Plus className="h-4 w-4 mr-2" />
                Record Trade
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Leaderboards */}
      {allTrades.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* All-Time Leaders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                All-Time Trade Leaders
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {leaderboards.allTime.map((entry, index) => (
                  <div
                    key={entry.teamId}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-bold w-5 ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {index + 1}.
                      </span>
                      <span className="font-medium">{entry.teamName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {entry.tradeCount}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Season Leaders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                {leaderboards.currentSeasonYear} Season Leaders
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {leaderboards.currentSeason.length > 0 ? (
                  leaderboards.currentSeason.map((entry, index) => (
                    <div
                      key={entry.teamId}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold w-5 ${index === 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                          {index + 1}.
                        </span>
                        <span className="font-medium">{entry.teamName}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {entry.tradeCount}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No trades this season</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {allTrades.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No trades recorded yet.
            {commissioner && (
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link href="/trades/new">Record your first trade</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        seasons.map((season) => (
          <Card key={season}>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {season}
                <Badge variant="secondary" className="text-xs">
                  {tradesBySeason.get(season)!.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                {tradesBySeason.get(season)!.map((trade) => {
                  const groupedByReceiver = groupAssetsByReceiver(trade.assets);

                  return (
                    <div
                      key={trade.id}
                      className="py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        {/* Date */}
                        <span className="text-xs text-muted-foreground w-16 flex-shrink-0 pt-0.5">
                          {formatCompactDate(trade.tradeDate)}
                        </span>

                        {/* Trade content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {groupedByReceiver.map((group, idx) => (
                              <div key={group.abbr} className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs font-bold px-1.5 py-0">
                                  {group.abbr}
                                </Badge>
                                <span className="text-muted-foreground">gets</span>
                                <span className="truncate">
                                  {group.assets.map((a, i) => (
                                    <span key={a.id}>
                                      {i > 0 && ", "}
                                      <span className="font-medium">{getAssetDisplay(a)}</span>
                                    </span>
                                  ))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Delete button */}
                        {commissioner && (
                          <DeleteTradeButton
                            tradeId={trade.id}
                            tradeDate={formatCompactDate(trade.tradeDate)}
                            teamAbbrs={trade.participants.map((p) => p.teamAbbr)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
