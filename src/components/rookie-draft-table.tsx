"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface DraftPick {
  id: number;
  year: number;
  round: number;
  pick: number;
  overallPick: string;
  playerName: string;
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  position: string | null;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface RookieDraftTableProps {
  draftHistory: DraftPick[];
  years: number[];
  teams: Team[];
  isCommissioner?: boolean;
}

export function RookieDraftTable({
  draftHistory,
  years,
  teams,
  isCommissioner = false,
}: RookieDraftTableProps) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPick, setEditingPick] = useState<DraftPick | null>(null);
  const [editForm, setEditForm] = useState({
    round: "",
    pick: "",
    teamId: "",
    playerName: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPick, setDeletingPick] = useState<DraftPick | null>(null);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  // Get unique rounds from the data
  const rounds = useMemo(() => {
    const uniqueRounds = [...new Set(draftHistory.map((d) => d.round))];
    return uniqueRounds.sort((a, b) => a - b);
  }, [draftHistory]);

  // Filter the draft history
  const filteredHistory = useMemo(() => {
    return draftHistory.filter((pick) => {
      if (yearFilter !== "all" && pick.year !== parseInt(yearFilter)) {
        return false;
      }
      if (teamFilter !== "all" && pick.teamId !== parseInt(teamFilter)) {
        return false;
      }
      if (roundFilter !== "all" && pick.round !== parseInt(roundFilter)) {
        return false;
      }
      if (
        searchQuery &&
        !pick.playerName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [draftHistory, yearFilter, teamFilter, roundFilter, searchQuery]);

  // Group by year for display
  const groupedByYear = useMemo(() => {
    const grouped: Record<number, DraftPick[]> = {};
    filteredHistory.forEach((pick) => {
      if (!grouped[pick.year]) {
        grouped[pick.year] = [];
      }
      grouped[pick.year].push(pick);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([year, picks]) => ({
        year: parseInt(year),
        picks: picks.sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.pick - b.pick;
        }),
      }));
  }, [filteredHistory]);

  const getRoundBadgeColor = (round: number) => {
    switch (round) {
      case 1:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case 2:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
      case 3:
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case 4:
        return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getPositionBadgeColor = (position: string | null) => {
    switch (position) {
      case "QB":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "WR":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "RB":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "TE":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Edit functions
  const openEditDialog = (pick: DraftPick) => {
    setEditingPick(pick);
    setEditForm({
      round: pick.round.toString(),
      pick: pick.pick.toString(),
      teamId: pick.teamId.toString(),
      playerName: pick.playerName,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPick) return;

    const pickNum = parseInt(editForm.pick);
    if (isNaN(pickNum) || pickNum < 1 || pickNum > 12) {
      toast.error("Pick must be between 1 and 12");
      return;
    }

    if (!editForm.playerName.trim()) {
      toast.error("Player name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/rookie-draft/pick", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPick.id,
          round: parseInt(editForm.round),
          pick: pickNum,
          teamId: parseInt(editForm.teamId),
          playerName: editForm.playerName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update pick");
      }

      toast.success("Draft pick updated successfully");
      setEditDialogOpen(false);
      setEditingPick(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  // Delete functions
  const openDeleteDialog = (pick: DraftPick) => {
    setDeletingPick(pick);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingPick) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/rookie-draft/pick?id=${deletingPick.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete pick");
      }

      toast.success("Draft pick deleted");
      setDeleteDialogOpen(false);
      setDeletingPick(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <Input
            placeholder="Search player..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id.toString()}>
                {team.abbreviation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roundFilter} onValueChange={setRoundFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rounds</SelectItem>
            {rounds.map((round) => (
              <SelectItem key={round} value={round.toString()}>
                Round {round}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredHistory.length} of {draftHistory.length} picks
      </p>

      {/* Table */}
      {groupedByYear.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {draftHistory.length === 0
            ? "No draft history yet. Import draft data to get started."
            : "No picks match your filters."}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByYear.map(({ year, picks }) => (
            <div key={year}>
              <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-background py-2">
                {year} Rookie Draft
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({picks.length} picks)
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Pick</TableHead>
                      <TableHead className="w-20">Round</TableHead>
                      <TableHead className="w-32">Team</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-16">Pos</TableHead>
                      {isCommissioner && (
                        <TableHead className="w-16"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picks.map((pick, index) => (
                      <TableRow
                        key={pick.id}
                        className="row-hover animate-fade-in"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <TableCell className="font-mono font-medium">
                          {pick.overallPick}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getRoundBadgeColor(
                              pick.round
                            )}`}
                          >
                            R{pick.round}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {pick.teamName}
                        </TableCell>
                        <TableCell>{pick.playerName}</TableCell>
                        <TableCell>
                          {pick.position ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getPositionBadgeColor(pick.position)}`}
                            >
                              {pick.position}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        {isCommissioner && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(pick)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(pick)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Draft Pick</DialogTitle>
            <DialogDescription>
              Update the details for this draft pick
            </DialogDescription>
          </DialogHeader>
          {editingPick && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground mb-2">
                Editing: {editingPick.year} Draft - Pick {editingPick.overallPick}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-round">Round</Label>
                  <Select
                    value={editForm.round}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, round: value })
                    }
                  >
                    <SelectTrigger id="edit-round">
                      <SelectValue placeholder="Select round" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <SelectItem key={r} value={r.toString()}>
                          Round {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pick">Pick # (1-12)</Label>
                  <Input
                    id="edit-pick"
                    type="number"
                    min={1}
                    max={12}
                    value={editForm.pick}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pick: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team">Team</Label>
                <Select
                  value={editForm.teamId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, teamId: value })
                  }
                >
                  <SelectTrigger id="edit-team">
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
                <Label htmlFor="edit-playerName">Player Name</Label>
                <Input
                  id="edit-playerName"
                  value={editForm.playerName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, playerName: e.target.value })
                  }
                />
              </div>
              {editForm.pick && editForm.round && (
                <p className="text-sm text-muted-foreground">
                  New pick format:{" "}
                  <span className="font-mono font-medium">
                    {editForm.round}.{editForm.pick.padStart(2, "0")}
                  </span>
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Pick</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft pick? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingPick && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{deletingPick.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {deletingPick.year} Draft - Pick {deletingPick.overallPick} -{" "}
                  {deletingPick.teamAbbreviation}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
