"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasterPlayer {
  id: number;
  name: string;
  position: string;
  nflTeam: string | null;
  yearAcquired: number;
}

interface AddPlayerFormProps {
  teamSlug: string;
}

const DEFAULT_SALARY_YEAR = 2025;

export function AddPlayerForm({ teamSlug }: AddPlayerFormProps) {
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

  // Fetch master players and current season when form opens
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
      // Send the salary as entered for the current season
      // The salaryYear tells the engine which year this salary applies to
      const res = await fetch(`/api/teams/${teamSlug}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          position: selectedPlayer.position,
          salary: Number(salary),
          salaryYear: currentSeason,
          yearAcquired: selectedPlayer.yearAcquired, // Auto-populated from master list
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

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        + Add Player
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add Player</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Selection from Master List */}
          <div className="space-y-2">
            <Label>Select Player from Registry</Label>
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
                      {selectedPlayer.name} ({selectedPlayer.position})
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
                      {masterPlayers.map((player) => (
                        <CommandItem
                          key={player.id}
                          value={`${player.name} ${player.position}`}
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
                          <span className="flex-1">
                            {player.name}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {player.position}
                          </span>
                          {player.nflTeam && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {player.nflTeam}
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
            <div className="rounded-md bg-muted p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-medium">{selectedPlayer.position}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Year Acquired</p>
                  <p className="font-medium">{selectedPlayer.yearAcquired}</p>
                </div>
                {selectedPlayer.nflTeam && (
                  <div>
                    <p className="text-xs text-muted-foreground">NFL Team</p>
                    <p className="font-medium">{selectedPlayer.nflTeam}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </CardContent>
    </Card>
  );
}
