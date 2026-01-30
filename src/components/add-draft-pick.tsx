"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface AddDraftPickProps {
  teams: Team[];
  existingYears: number[];
}

export function AddDraftPick({ teams, existingYears }: AddDraftPickProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set([...existingYears, currentYear, currentYear + 1])
  ).sort((a, b) => b - a);

  const [year, setYear] = useState(currentYear.toString());
  const [round, setRound] = useState("1");
  const [pick, setPick] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerName, setPlayerName] = useState("");

  const resetForm = () => {
    setYear(currentYear.toString());
    setRound("1");
    setPick("");
    setTeamId("");
    setPlayerName("");
  };

  const handleSubmit = async () => {
    if (!pick || !teamId || !playerName.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const pickNum = parseInt(pick);
    if (isNaN(pickNum) || pickNum < 1 || pickNum > 12) {
      toast.error("Pick must be between 1 and 12");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/rookie-draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parseInt(year),
          round: parseInt(round),
          pick: pickNum,
          teamId: parseInt(teamId),
          playerName: playerName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add draft pick");
      }

      toast.success("Draft pick added successfully");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add pick");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Pick
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Draft Pick</DialogTitle>
          <DialogDescription>
            Manually add a single rookie draft pick
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="round">Round</Label>
              <Select value={round} onValueChange={setRound}>
                <SelectTrigger id="round">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pick">Pick # (1-12)</Label>
              <Input
                id="pick"
                type="number"
                min={1}
                max={12}
                placeholder="e.g., 1"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerName">Player Name</Label>
            <Input
              id="playerName"
              placeholder="e.g., Breece Hall"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          {pick && round && (
            <p className="text-sm text-muted-foreground">
              Pick will be recorded as: <span className="font-mono font-medium">{round}.{pick.padStart(2, '0')}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding..." : "Add Pick"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
