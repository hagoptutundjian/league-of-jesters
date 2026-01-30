import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants, teams, players } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

export const dynamic = "force-dynamic";

async function getTradesWithDetails() {
  const allTrades = await db
    .select()
    .from(trades)
    .orderBy(desc(trades.tradeDate))
    .limit(200);

  const tradesWithDetails = await Promise.all(
    allTrades.map(async (trade) => {
      const assets = await db
        .select({
          id: tradeAssets.id,
          assetType: tradeAssets.assetType,
          description: tradeAssets.description,
          fromTeamId: tradeAssets.fromTeamId,
          toTeamId: tradeAssets.toTeamId,
          playerName: players.name,
          fromTeamName: teams.name,
        })
        .from(tradeAssets)
        .leftJoin(players, eq(tradeAssets.playerId, players.id))
        .leftJoin(teams, eq(tradeAssets.fromTeamId, teams.id))
        .where(eq(tradeAssets.tradeId, trade.id));

      return {
        ...trade,
        assets,
      };
    })
  );

  return tradesWithDetails;
}

export default async function TradesPage() {
  const allTrades = await getTradesWithDetails();

  // Group by season
  const tradesBySeason = new Map<number, typeof allTrades>();
  for (const trade of allTrades) {
    if (!tradesBySeason.has(trade.season)) {
      tradesBySeason.set(trade.season, []);
    }
    tradesBySeason.get(trade.season)!.push(trade);
  }

  const seasons = Array.from(tradesBySeason.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
        <p className="text-muted-foreground">
          All trades across all seasons
        </p>
      </div>

      {allTrades.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No trades recorded yet.
          </CardContent>
        </Card>
      ) : (
        seasons.map((season) => (
          <Card key={season}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {season} Season
                <Badge variant="secondary">
                  {tradesBySeason.get(season)!.length} trades
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tradesBySeason.get(season)!.map((trade) => (
                  <div
                    key={trade.id}
                    className="rounded-md border p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {new Date(trade.tradeDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                    {trade.assets.length > 0 ? (
                      <div className="space-y-1 text-sm">
                        {trade.assets.map((asset) => (
                          <div key={asset.id} className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0">
                              {asset.fromTeamName}
                            </Badge>
                            <span className="text-muted-foreground">sends</span>
                            <span className="font-medium">
                              {asset.playerName || asset.description || "Unknown asset"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      trade.notes && (
                        <p className="text-sm">{trade.notes}</p>
                      )
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
