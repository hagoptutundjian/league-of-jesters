import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants, teams, players, draftPicks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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
import { ArrowRight, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

interface TradeAssetWithDetails {
  id: number;
  assetType: "player" | "draft_pick";
  description: string | null;
  fromTeamId: number;
  toTeamId: number;
  playerName: string | null;
  fromTeamName: string;
  fromTeamAbbr: string;
  toTeamName: string;
  toTeamAbbr: string;
  draftPickYear: number | null;
  draftPickRound: number | null;
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

          // If teams not in participants (shouldn't happen), fetch them
          let fromTeamName = fromTeam?.teamName || "";
          let fromTeamAbbr = fromTeam?.teamAbbr || "";
          let toTeamName = toTeam?.teamName || "";
          let toTeamAbbr = toTeam?.teamAbbr || "";

          if (!fromTeam) {
            const t = await db.select().from(teams).where(eq(teams.id, asset.fromTeamId)).limit(1);
            fromTeamName = t[0]?.name || "Unknown";
            fromTeamAbbr = t[0]?.abbreviation || "???";
          }
          if (!toTeam) {
            const t = await db.select().from(teams).where(eq(teams.id, asset.toTeamId)).limit(1);
            toTeamName = t[0]?.name || "Unknown";
            toTeamAbbr = t[0]?.abbreviation || "???";
          }

          return {
            id: asset.id,
            assetType: asset.assetType,
            description: asset.description,
            fromTeamId: asset.fromTeamId,
            toTeamId: asset.toTeamId,
            playerName,
            fromTeamName,
            fromTeamAbbr,
            toTeamName,
            toTeamAbbr,
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

export default async function TradesPage() {
  const [allTrades, commissioner] = await Promise.all([
    getTradesWithDetails(),
    isCommissioner(),
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
    const grouped = new Map<number, { team: string; abbr: string; assets: TradeAssetWithDetails[] }>();
    for (const asset of assets) {
      if (!grouped.has(asset.toTeamId)) {
        grouped.set(asset.toTeamId, {
          team: asset.toTeamName,
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
      return `${asset.draftPickYear} Round ${asset.draftPickRound}`;
    }
    return asset.description || "Unknown asset";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
          <p className="text-muted-foreground">
            All trades across all seasons
          </p>
        </div>
        {commissioner && (
          <Button asChild>
            <Link href="/trades/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Trade
            </Link>
          </Button>
        )}
      </div>

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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {season} Season
                <Badge variant="secondary">
                  {tradesBySeason.get(season)!.length} trade{tradesBySeason.get(season)!.length !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tradesBySeason.get(season)!.map((trade) => {
                  const groupedByReceiver = groupAssetsByReceiver(trade.assets);
                  const isMultiTeam = trade.participants.length > 2;

                  return (
                    <div
                      key={trade.id}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {new Date(trade.tradeDate).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                          {isMultiTeam && (
                            <Badge variant="outline" className="text-xs">
                              {trade.participants.length}-team trade
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {trade.participants.map((p) => (
                            <Badge key={p.teamId} variant="secondary" className="text-xs">
                              {p.teamAbbr}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Show what each team receives */}
                      <div className={`grid gap-3 ${groupedByReceiver.length > 2 ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
                        {groupedByReceiver.map((group) => (
                          <div
                            key={group.abbr}
                            className="bg-muted/50 rounded-md p-3"
                          >
                            <p className="font-medium text-sm mb-2">
                              {group.team} receives:
                            </p>
                            <ul className="space-y-1">
                              {group.assets.map((asset) => (
                                <li
                                  key={asset.id}
                                  className="text-sm flex items-center gap-2"
                                >
                                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span>{getAssetDisplay(asset)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    from {asset.fromTeamAbbr}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {trade.notes && (
                        <p className="text-sm text-muted-foreground italic border-t pt-2">
                          Note: {trade.notes}
                        </p>
                      )}
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
