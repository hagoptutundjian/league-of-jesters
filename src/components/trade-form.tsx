"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, ArrowRightLeft, Loader2 } from "lucide-react";

interface Team {
  id: number;
  name: string;
  slug: string;
  abbreviation: string;
}

interface PlayerAsset {
  type: "player";
  id: number;
  contractId: number;
  name: string;
  position: string | null;
  nflTeam: string | null;
  salary: string;
  label: string;
}

interface PickAsset {
  type: "draft_pick";
  id: number;
  year: number;
  round: number;
  pickNumber: number | null;
  originalTeamAbbr: string;
  label: string;
}

type Asset = PlayerAsset | PickAsset;

interface TeamAssets {
  teamId: number;
  teamName: string;
  players: PlayerAsset[];
  picks: PickAsset[];
}

interface TradeParticipant {
  teamId: string;
  teamSlug: string;
  teamName: string;
  assets: TeamAssets | null;
  selectedAssets: Asset[];
  receiving: Asset[]; // Populated after asset assignment
}

interface TradeFormProps {
  teams: Team[];
  currentSeason: number;
}

export function TradeForm({ teams, currentSeason }: TradeFormProps) {
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [season, setSeason] = useState(currentSeason.toString());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<TradeParticipant[]>([
    { teamId: "", teamSlug: "", teamName: "", assets: null, selectedAssets: [], receiving: [] },
    { teamId: "", teamSlug: "", teamName: "", assets: null, selectedAssets: [], receiving: [] },
  ]);
  const router = useRouter();

  // Season options (5 years back to 2 years forward)
  const seasonOptions = Array.from(
    { length: 8 },
    (_, i) => currentSeason - 5 + i
  );

  // Fetch team assets when team is selected
  const fetchTeamAssets = useCallback(async (teamSlug: string): Promise<TeamAssets | null> => {
    try {
      const res = await fetch(`/api/teams/${teamSlug}/tradeable-assets`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const handleTeamChange = async (index: number, teamId: string) => {
    const team = teams.find((t) => t.id.toString() === teamId);
    if (!team) return;

    // Check if team is already in the trade
    if (participants.some((p, i) => i !== index && p.teamId === teamId)) {
      toast.error("This team is already in the trade");
      return;
    }

    const updated = [...participants];
    updated[index] = {
      teamId,
      teamSlug: team.slug,
      teamName: team.name,
      assets: null,
      selectedAssets: [],
      receiving: [],
    };
    setParticipants(updated);

    // Fetch assets
    const assets = await fetchTeamAssets(team.slug);
    if (assets) {
      const newUpdated = [...participants];
      newUpdated[index] = { ...updated[index], assets };
      setParticipants(newUpdated);
    }
  };

  const toggleAsset = (participantIndex: number, asset: Asset) => {
    const updated = [...participants];
    const participant = updated[participantIndex];
    const isSelected = participant.selectedAssets.some(
      (a) => a.type === asset.type && a.id === asset.id
    );

    if (isSelected) {
      participant.selectedAssets = participant.selectedAssets.filter(
        (a) => !(a.type === asset.type && a.id === asset.id)
      );
    } else {
      participant.selectedAssets = [...participant.selectedAssets, asset];
    }

    setParticipants(updated);
  };

  const addTeam = () => {
    if (participants.length >= 4) {
      toast.error("Maximum 4 teams in a trade");
      return;
    }
    setParticipants([
      ...participants,
      { teamId: "", teamSlug: "", teamName: "", assets: null, selectedAssets: [], receiving: [] },
    ]);
  };

  const removeTeam = (index: number) => {
    if (participants.length <= 2) {
      toast.error("Minimum 2 teams required");
      return;
    }
    setParticipants(participants.filter((_, i) => i !== index));
  };

  // For 2-team trades, assets go to the other team automatically
  // For 3+ team trades, we need destination assignment
  const [assetDestinations, setAssetDestinations] = useState<
    Map<string, string>
  >(new Map());

  const getAssetKey = (asset: Asset, fromTeamId: string) =>
    `${asset.type}-${asset.id}-${fromTeamId}`;

  const setAssetDestination = (
    asset: Asset,
    fromTeamId: string,
    toTeamId: string
  ) => {
    const key = getAssetKey(asset, fromTeamId);
    const newMap = new Map(assetDestinations);
    newMap.set(key, toTeamId);
    setAssetDestinations(newMap);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate
    const activeParticipants = participants.filter((p) => p.teamId);
    if (activeParticipants.length < 2) {
      toast.error("At least 2 teams required");
      setLoading(false);
      return;
    }

    const allAssets: {
      assetType: "player" | "draft_pick";
      playerId?: number;
      contractId?: number;
      draftPickId?: number;
      fromTeamId: number;
      toTeamId: number;
      description: string;
    }[] = [];

    // Build assets with destinations
    for (const participant of activeParticipants) {
      for (const asset of participant.selectedAssets) {
        let toTeamId: number;

        if (activeParticipants.length === 2) {
          // 2-team trade: assets go to the other team
          toTeamId = parseInt(
            activeParticipants.find((p) => p.teamId !== participant.teamId)!
              .teamId
          );
        } else {
          // Multi-team trade: check destination map
          const key = getAssetKey(asset, participant.teamId);
          const destId = assetDestinations.get(key);
          if (!destId) {
            toast.error(`Please select destination for ${asset.label}`);
            setLoading(false);
            return;
          }
          toTeamId = parseInt(destId);
        }

        if (asset.type === "player") {
          allAssets.push({
            assetType: "player",
            playerId: asset.id,
            contractId: asset.contractId,
            fromTeamId: parseInt(participant.teamId),
            toTeamId,
            description: asset.name,
          });
        } else {
          allAssets.push({
            assetType: "draft_pick",
            draftPickId: asset.id,
            fromTeamId: parseInt(participant.teamId),
            toTeamId,
            description: asset.label,
          });
        }
      }
    }

    if (allAssets.length === 0) {
      toast.error("At least one asset must be traded");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeDate,
          season: Number(season),
          notes,
          assets: allAssets,
          executeTransfer: true, // New flag to actually move assets
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to record trade");
        return;
      }

      toast.success("Trade recorded and executed successfully!");
      router.push("/trades");
      router.refresh();
    } catch {
      toast.error("Failed to record trade");
    } finally {
      setLoading(false);
    }
  };

  const isMultiTeam = participants.filter((p) => p.teamId).length > 2;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Trade Details */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Trade Date</Label>
            <Input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Season</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasonOptions.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trade notes..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Teams */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Teams in Trade</h2>
          {participants.length < 4 && (
            <Button type="button" variant="outline" size="sm" onClick={addTeam}>
              <Plus className="h-4 w-4 mr-1" />
              Add Team
            </Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {participants.map((participant, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Team {index + 1}</CardTitle>
                  {participants.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeTeam(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Select
                  value={participant.teamId}
                  onValueChange={(v) => handleTeamChange(index, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>

              {participant.teamId && (
                <CardContent className="space-y-4">
                  {!participant.assets ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading assets...
                    </div>
                  ) : (
                    <>
                      {/* Players */}
                      {participant.assets.players.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                            Players
                          </Label>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {participant.assets.players.map((player) => {
                              const isSelected = participant.selectedAssets.some(
                                (a) => a.type === "player" && a.id === player.id
                              );
                              return (
                                <div
                                  key={player.id}
                                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 border-primary"
                                      : "hover:bg-muted"
                                  }`}
                                  onClick={() => toggleAsset(index, player)}
                                >
                                  <Checkbox checked={isSelected} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {player.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {player.position} · ${Number(player.salary).toFixed(0)}
                                    </p>
                                  </div>
                                  {isSelected && isMultiTeam && (
                                    <Select
                                      value={
                                        assetDestinations.get(
                                          getAssetKey(player, participant.teamId)
                                        ) || ""
                                      }
                                      onValueChange={(v) =>
                                        setAssetDestination(
                                          player,
                                          participant.teamId,
                                          v
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        className="w-28 h-7 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <SelectValue placeholder="To..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {participants
                                          .filter(
                                            (p) =>
                                              p.teamId &&
                                              p.teamId !== participant.teamId
                                          )
                                          .map((p) => (
                                            <SelectItem key={p.teamId} value={p.teamId}>
                                              {p.teamName}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Draft Picks */}
                      {participant.assets.picks.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                            Draft Picks
                          </Label>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {participant.assets.picks.map((pick) => {
                              const isSelected = participant.selectedAssets.some(
                                (a) => a.type === "draft_pick" && a.id === pick.id
                              );
                              return (
                                <div
                                  key={pick.id}
                                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 border-primary"
                                      : "hover:bg-muted"
                                  }`}
                                  onClick={() => toggleAsset(index, pick)}
                                >
                                  <Checkbox checked={isSelected} />
                                  <span className="text-sm flex-1">{pick.label}</span>
                                  {isSelected && isMultiTeam && (
                                    <Select
                                      value={
                                        assetDestinations.get(
                                          getAssetKey(pick, participant.teamId)
                                        ) || ""
                                      }
                                      onValueChange={(v) =>
                                        setAssetDestination(
                                          pick,
                                          participant.teamId,
                                          v
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        className="w-28 h-7 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <SelectValue placeholder="To..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {participants
                                          .filter(
                                            (p) =>
                                              p.teamId &&
                                              p.teamId !== participant.teamId
                                          )
                                          .map((p) => (
                                            <SelectItem key={p.teamId} value={p.teamId}>
                                              {p.teamName}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {participant.assets.players.length === 0 &&
                        participant.assets.picks.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No tradeable assets
                          </p>
                        )}

                      {/* Selected summary */}
                      {participant.selectedAssets.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">
                            Trading away:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {participant.selectedAssets.map((asset) => (
                              <Badge
                                key={`${asset.type}-${asset.id}`}
                                variant="secondary"
                                className="text-xs"
                              >
                                {asset.type === "player" ? asset.name : asset.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Trade Summary for 2-team trades */}
      {!isMultiTeam &&
        participants[0]?.selectedAssets.length > 0 &&
        participants[1]?.selectedAssets.length > 0 && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Trade Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-sm mb-2">
                    {participants[0].teamName} receives:
                  </p>
                  <div className="space-y-1">
                    {participants[1].selectedAssets.map((asset) => (
                      <p key={`${asset.type}-${asset.id}`} className="text-sm">
                        • {asset.type === "player" ? asset.name : asset.label}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">
                    {participants[1].teamName} receives:
                  </p>
                  <div className="space-y-1">
                    {participants[0].selectedAssets.map((asset) => (
                      <p key={`${asset.type}-${asset.id}`} className="text-sm">
                        • {asset.type === "player" ? asset.name : asset.label}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Recording Trade...
          </>
        ) : (
          "Record Trade"
        )}
      </Button>
    </form>
  );
}
