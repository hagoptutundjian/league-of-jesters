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
import { toast } from "sonner";

interface AddPlayerAdminProps {
  teams: { id: number; name: string; slug: string }[];
}

const DEFAULT_SALARY_YEAR = 2025;

export function AddPlayerAdmin({ teams }: AddPlayerAdminProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(DEFAULT_SALARY_YEAR);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("QB");
  const [salary, setSalary] = useState("");
  const [yearAcquired, setYearAcquired] = useState("2025");
  const [teamId, setTeamId] = useState("");
  const [rosterStatus, setRosterStatus] = useState("active");
  const [acquisitionType, setAcquisitionType] = useState("auction");
  const router = useRouter();

  // Fetch current season when form opens
  useEffect(() => {
    if (open) {
      fetch("/api/settings/current-season")
        .then((res) => res.json())
        .then((data) => {
          if (data.currentSeason) {
            setCurrentSeason(data.currentSeason);
            setYearAcquired(data.currentSeason.toString());
          }
        })
        .catch(() => {
          setCurrentSeason(DEFAULT_SALARY_YEAR);
        });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !salary || !teamId) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);

    try {
      // Send the salary as entered for the current season
      // The salaryYear tells the engine which year this salary applies to
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: name,
          position,
          salary2025: Number(salary),
          salaryYear: currentSeason,
          yearAcquired: Number(yearAcquired),
          teamId: Number(teamId),
          rosterStatus,
          acquisitionType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add player");
        return;
      }

      toast.success(`${name} added successfully`);
      // Reset form
      setName("");
      setSalary("");
      setTeamId("");
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
      <Button onClick={() => setOpen(true)}>+ Add Player</Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add New Player</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Player Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Patrick Mahomes"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Position *</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QB">QB</SelectItem>
                  <SelectItem value="WR">WR</SelectItem>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team *</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{currentSeason} Salary ($) *</Label>
              <Input
                type="number"
                min="1"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 99"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Year Acquired *</Label>
              <Select value={yearAcquired} onValueChange={setYearAcquired}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2020, 2021, 2022, 2023, 2024, 2025].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Acquisition Type</Label>
              <Select value={acquisitionType} onValueChange={setAcquisitionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auction">Auction</SelectItem>
                  <SelectItem value="rookie_draft">Rookie Draft</SelectItem>
                  <SelectItem value="free_agent">Free Agent</SelectItem>
                  <SelectItem value="faab">FAAB</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roster Status</Label>
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
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Player"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
