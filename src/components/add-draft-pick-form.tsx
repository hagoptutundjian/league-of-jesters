"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

interface AddDraftPickFormProps {
  teams: { id: number; name: string; slug: string }[];
}

export function AddDraftPickForm({ teams }: AddDraftPickFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState("2026");
  const [round, setRound] = useState("1");
  const [originalTeamId, setOriginalTeamId] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/draft-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(year),
          round: Number(round),
          originalTeamId: Number(originalTeamId),
          currentTeamId: Number(currentTeamId || originalTeamId),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add draft pick");
        return;
      }

      toast.success("Draft pick added");
      setOriginalTeamId("");
      setCurrentTeamId("");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to add draft pick");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>+ Add Draft Pick</Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add Draft Pick</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Round</Label>
            <Select value={round} onValueChange={setRound}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((r) => (
                  <SelectItem key={r} value={r.toString()}>
                    Round {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Original Team</Label>
            <Select value={originalTeamId} onValueChange={(v) => {
              setOriginalTeamId(v);
              if (!currentTeamId) setCurrentTeamId(v);
            }}>
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
            <Label>Current Owner</Label>
            <Select value={currentTeamId} onValueChange={setCurrentTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Same as original" />
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
          <div className="flex items-end">
            <Button type="submit" disabled={loading || !originalTeamId}>
              {loading ? "Adding..." : "Add Pick"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
