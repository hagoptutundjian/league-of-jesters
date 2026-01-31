"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gavel, Trash2, Search, DollarSign } from "lucide-react";

interface FreeAgent {
  id: number;
  name: string;
  position: string | null;
  nflTeam: string | null;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface AuctionPick {
  id: number;
  pickOrder: number;
  playerId: number;
  playerName: string;
  position: string | null;
  salary: string;
  teamId: number;
  teamName: string;
  teamAbbr: string;
  createdAt: string;
}

const POSITIONS = ["QB", "WR", "RB", "TE"];

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  WR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RB: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  TE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function FreeAgentAuctionAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSeason, setCurrentSeason] = useState<number>(2025);
  const [auctionPicks, setAuctionPicks] = useState<AuctionPick[]>([]);
  const [nextPickOrder, setNextPickOrder] = useState(1);

  // Form state
  const [selectedPlayer, setSelectedPlayer] = useState<FreeAgent | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [salary, setSalary] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [drafting, setDrafting] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPick, setDeletingPick] = useState<AuctionPick | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/admin/free-agent-auction");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setFreeAgents(data.freeAgents);
      setTeams(data.teams);
      setCurrentSeason(data.currentSeason);
      setAuctionPicks(data.currentAuctionPicks);
      setNextPickOrder(data.nextPickOrder);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredFreeAgents = useMemo(() => {
    if (!searchQuery.trim()) return freeAgents;
    const query = searchQuery.toLowerCase();
    return freeAgents.filter(
      (fa) =>
        fa.name.toLowerCase().includes(query) ||
        fa.position?.toLowerCase().includes(query) ||
        fa.nflTeam?.toLowerCase().includes(query)
    );
  }, [freeAgents, searchQuery]);

  const handleSelectPlayer = (player: FreeAgent) => {
    setSelectedPlayer(player);
    setPosition(player.position || "");
    setSelectedTeamId("");
    setSalary("");
  };

  const handleDraft = async () => {
    if (!selectedPlayer || !selectedTeamId || !salary) {
      toast.error("Please fill in all required fields");
      return;
    }

    const salaryNum = parseFloat(salary);
    if (isNaN(salaryNum) || salaryNum < 0) {
      toast.error("Please enter a valid salary");
      return;
    }

    if (!position) {
      toast.error("Please select a position");
      return;
    }

    setDrafting(true);
    try {
      const response = await fetch("/api/admin/free-agent-auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          teamId: parseInt(selectedTeamId, 10),
          salary: salaryNum,
          position,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to draft player");
      }

      toast.success(`${selectedPlayer.name} drafted!`);
      setSelectedPlayer(null);
      setSelectedTeamId("");
      setSalary("");
      setPosition("");
      setSearchQuery("");
      await fetchData();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to draft");
    } finally {
      setDrafting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPick) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/free-agent-auction?id=${deletingPick.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete");
      }

      toast.success("Pick removed");
      setDeleteDialogOpen(false);
      setDeletingPick(null);
      await fetchData();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Draft Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Draft Free Agent
          </CardTitle>
          <CardDescription>
            Select a free agent, set their salary, and assign to a team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Free Agents</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, position, or NFL team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Player list */}
          <div className="space-y-2">
            <Label>Available Free Agents ({filteredFreeAgents.length})</Label>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {filteredFreeAgents.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {freeAgents.length === 0
                    ? "No free agents available"
                    : "No matches found"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredFreeAgents.slice(0, 50).map((fa) => (
                    <button
                      key={fa.id}
                      onClick={() => handleSelectPlayer(fa)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center justify-between ${
                        selectedPlayer?.id === fa.id
                          ? "bg-primary/10 border-l-2 border-primary"
                          : ""
                      }`}
                    >
                      <span className="font-medium">{fa.name}</span>
                      <div className="flex items-center gap-2">
                        {fa.position && (
                          <Badge
                            variant="outline"
                            className={POSITION_COLORS[fa.position] || ""}
                          >
                            {fa.position}
                          </Badge>
                        )}
                        {fa.nflTeam && (
                          <span className="text-xs text-muted-foreground">
                            {fa.nflTeam}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredFreeAgents.length > 50 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      Showing 50 of {filteredFreeAgents.length} - refine your search
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected player form */}
          {selectedPlayer && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
              <div className="font-semibold text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Drafting: {selectedPlayer.name}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="team">Team *</Label>
                  <Select
                    value={selectedTeamId}
                    onValueChange={setSelectedTeamId}
                  >
                    <SelectTrigger id="team">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.abbreviation} - {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary">Salary *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="salary"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="position">
                    Position *{" "}
                    {selectedPlayer.position && (
                      <span className="text-muted-foreground font-normal">
                        (auto-filled)
                      </span>
                    )}
                  </Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleDraft}
                disabled={drafting || !selectedTeamId || !salary || !position}
                className="w-full"
              >
                {drafting ? "Drafting..." : `Draft ${selectedPlayer.name}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auction Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{currentSeason} Auction Results</span>
            <Badge variant="secondary">{auctionPicks.length} picks</Badge>
          </CardTitle>
          <CardDescription>
            Players drafted in the current free agent auction
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auctionPicks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No picks yet. Draft your first player!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="w-16">Pos</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auctionPicks.map((pick) => (
                    <TableRow key={pick.id}>
                      <TableCell className="font-mono font-medium">
                        {pick.pickOrder}
                      </TableCell>
                      <TableCell className="font-medium">
                        {pick.playerName}
                      </TableCell>
                      <TableCell>
                        {pick.position && (
                          <Badge
                            variant="outline"
                            className={POSITION_COLORS[pick.position] || ""}
                          >
                            {pick.position}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{pick.teamAbbr}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(pick.salary).toFixed(0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingPick(pick);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Auction Pick</DialogTitle>
            <DialogDescription>
              This will remove the player from the team roster and delete the
              auction record. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingPick && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{deletingPick.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  Pick #{deletingPick.pickOrder} - {deletingPick.teamAbbr} - $
                  {Number(deletingPick.salary).toFixed(0)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Remove Pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
