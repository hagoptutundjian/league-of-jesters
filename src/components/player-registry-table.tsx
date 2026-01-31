"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Trash2, Check, X } from "lucide-react";
import { EditMasterPlayer } from "@/components/edit-master-player";
import { getPositionColor } from "@/lib/position-colors";

interface Player {
  id: number;
  name: string;
  position: string | null;
  yearAcquired: number;
  isActive: boolean;
  currentTeam: string | null;
  contractId: number | null;
  salary: number | null;
  salaryYear: number | null;
}

interface PlayerRegistryTableProps {
  players: Player[];
  currentSeason: number;
}

export function PlayerRegistryTable({ players, currentSeason }: PlayerRegistryTableProps) {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingSalaryId, setEditingSalaryId] = useState<number | null>(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);
  const router = useRouter();

  // Filter players by search term (name)
  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (playerId: number, playerName: string) => {
    setDeletingId(playerId);
    try {
      const res = await fetch("/api/admin/player-registry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete player");
        return;
      }

      toast.success(`${playerName} removed from registry`);
      router.refresh();
    } catch {
      toast.error("Failed to delete player");
    } finally {
      setDeletingId(null);
    }
  };

  const startEditingSalary = (player: Player) => {
    setEditingSalaryId(player.id);
    setSalaryInput(player.salary?.toString() || "");
  };

  const cancelEditingSalary = () => {
    setEditingSalaryId(null);
    setSalaryInput("");
  };

  const saveSalary = async (player: Player) => {
    if (!player.contractId) {
      toast.error("Player has no active contract");
      return;
    }

    const newSalary = parseFloat(salaryInput);
    if (isNaN(newSalary) || newSalary < 0) {
      toast.error("Please enter a valid salary");
      return;
    }

    setSavingSalary(true);
    try {
      const res = await fetch("/api/admin/player-registry/salary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: player.contractId,
          salary: newSalary,
          salaryYear: currentSeason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update salary");
        return;
      }

      toast.success(`${player.name}'s salary updated to $${newSalary}`);
      setEditingSalaryId(null);
      setSalaryInput("");
      router.refresh();
    } catch {
      toast.error("Failed to update salary");
    } finally {
      setSavingSalary(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search players by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      {search && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredPlayers.length} of {players.length} players
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead className="text-center">Year Acquired</TableHead>
              <TableHead className="text-right">Salary ({currentSeason})</TableHead>
              <TableHead>Current Team</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  {p.position ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPositionColor(p.position).badge}`}
                    >
                      {p.position}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not set</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {p.yearAcquired}
                </TableCell>
                <TableCell className="text-right">
                  {p.contractId ? (
                    editingSalaryId === p.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={salaryInput}
                          onChange={(e) => setSalaryInput(e.target.value)}
                          className="w-20 h-7 text-right text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSalary(p);
                            if (e.key === "Escape") cancelEditingSalary();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                          onClick={() => saveSalary(p)}
                          disabled={savingSalary}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={cancelEditingSalary}
                          disabled={savingSalary}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingSalary(p)}
                        className="font-mono hover:underline hover:text-primary cursor-pointer"
                        title="Click to edit salary"
                      >
                        ${p.salary}
                      </button>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.currentTeam ? (
                    <span>{p.currentTeam}</span>
                  ) : (
                    <span className="text-muted-foreground">Free Agent</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditMasterPlayer
                      playerId={p.id}
                      playerName={p.name}
                      yearAcquired={p.yearAcquired}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === p.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {p.name} from the master player registry.
                            {p.currentTeam && (
                              <span className="mt-2 block font-medium text-destructive">
                                Warning: This player is currently rostered by {p.currentTeam}.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(p.id, p.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredPlayers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  {search ? "No players match your search" : "No players in the master registry yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
