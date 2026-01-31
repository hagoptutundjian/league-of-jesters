"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasterPlayer {
  id: number;
  name: string;
  position: string | null;
  yearAcquired: number;
}

const DEFAULT_SALARY_YEAR = 2025;

interface AddPlayerInlineProps {
  teamSlug: string;
  position?: string; // Optional: pre-filter by position (QB, WR, RB, TE)
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  label?: string;
}

export function AddPlayerInline({
  teamSlug,
  position,
  variant = "ghost",
  size = "sm",
  label,
}: AddPlayerInlineProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [masterPlayers, setMasterPlayers] = useState<MasterPlayer[]>([]);
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(DEFAULT_SALARY_YEAR);

  // Selected player from master list
  const [selectedPlayer, setSelectedPlayer] = useState<MasterPlayer | null>(null);

  // Form fields
  const [salary, setSalary] = useState("");
  const [acquisitionType, setAcquisitionType] = useState("waiver_wire");
  const [rosterStatus, setRosterStatus] = useState("active");
  const router = useRouter();

  // Filter players by position if specified, but also include players without a position set
  // This allows adding new players who haven't been assigned a position yet
  const filteredPlayers = position
    ? masterPlayers.filter((p) => p.position === position || p.position === null)
    : masterPlayers;

  // Fetch master players and current season when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch players
      fetch("/api/admin/player-registry")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setMasterPlayers(data);
          }
        })
        .catch(() => {
          toast.error("Failed to load players");
        });

      // Fetch current season
      fetch("/api/settings/current-season")
        .then((res) => res.json())
        .then((data) => {
          if (data.currentSeason) {
            setCurrentSeason(data.currentSeason);
          }
        })
        .catch(() => {
          // Default to 2025 if fetch fails
          setCurrentSeason(DEFAULT_SALARY_YEAR);
        });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlayer) {
      toast.error("Please select a player from the list");
      return;
    }

    if (!salary) {
      toast.error("Please enter a salary");
      return;
    }

    setLoading(true);

    try {
      // Use the position group we're adding to (if specified), otherwise use player's existing position
      const positionToSet = position || selectedPlayer.position;

      // Send the salary as entered for the current season
      // The salaryYear tells the engine which year this salary applies to
      const res = await fetch(`/api/teams/${teamSlug}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          position: positionToSet,
          salary: Number(salary),
          salaryYear: currentSeason,
          yearAcquired: selectedPlayer.yearAcquired,
          acquisitionType,
          rosterStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add player");
        return;
      }

      toast.success(`${selectedPlayer.name} added to roster`);
      setSelectedPlayer(null);
      setSalary("");
      setAcquisitionType("waiver_wire");
      setRosterStatus("active");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to add player");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPlayer(null);
    setSalary("");
    setAcquisitionType("free_agent");
    setRosterStatus("active");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus className="h-4 w-4" />
          {label && <span className="ml-1">{label}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {position ? `${position}` : "Player"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Selection from Master List */}
          <div className="space-y-2">
            <Label>Select Player</Label>
            <Popover open={playerSearchOpen} onOpenChange={setPlayerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={playerSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedPlayer ? (
                    <span>
                      {selectedPlayer.name}
                      {selectedPlayer.position && ` (${selectedPlayer.position})`}
                    </span>
                  ) : (
                    "Search for a player..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search players..." />
                  <CommandList>
                    <CommandEmpty>No player found.</CommandEmpty>
                    <CommandGroup>
                      {filteredPlayers.map((player) => (
                        <CommandItem
                          key={player.id}
                          value={`${player.name} ${player.position || ""}`}
                          onSelect={() => {
                            setSelectedPlayer(player);
                            setPlayerSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPlayer?.id === player.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1">{player.name}</span>
                          {player.position && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {player.position}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Show auto-populated info when player is selected */}
          {selectedPlayer && (
            <div className="rounded-md bg-muted p-3">
              <div className="grid gap-2 grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-medium">{position || selectedPlayer.position || "Will be set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Year Acquired</p>
                  <p className="font-medium">{selectedPlayer.yearAcquired}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="salary">{currentSeason} Salary ($)</Label>
              <Input
                id="salary"
                type="number"
                min="1"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisitionType">Acquisition Type</Label>
              <Select value={acquisitionType} onValueChange={setAcquisitionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rookie_draft">Rookie Draft</SelectItem>
                  <SelectItem value="free_agent_auction">Free Agent Auction</SelectItem>
                  <SelectItem value="waiver_wire">Waiver Wire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rosterStatus">Roster Status</Label>
            <Select value={rosterStatus} onValueChange={setRosterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="practice_squad">Practice Squad</SelectItem>
                <SelectItem value="injured_reserve">Injured Reserve</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedPlayer}>
              {loading ? "Adding..." : "Add Player"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
