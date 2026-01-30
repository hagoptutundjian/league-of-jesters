"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

interface EditDraftPickButtonProps {
  pickId: number;
  year: number;
  round: number;
  originalTeamId: number;
  currentTeamId: number;
  teams: { id: number; name: string; slug: string }[];
}

export function EditDraftPickButton({
  pickId,
  year,
  round,
  originalTeamId,
  currentTeamId,
  teams,
}: EditDraftPickButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newCurrentTeamId, setNewCurrentTeamId] = useState(currentTeamId.toString());
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/draft-picks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickId,
          currentTeamId: Number(newCurrentTeamId),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update draft pick");
        return;
      }

      toast.success("Draft pick updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update draft pick");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this draft pick?")) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/draft-picks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete draft pick");
        return;
      }

      toast.success("Draft pick deleted");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete draft pick");
    } finally {
      setLoading(false);
    }
  };

  const originalTeam = teams.find((t) => t.id === originalTeamId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {year} Round {round} Pick
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Original team: <strong>{originalTeam?.name}</strong>
          </div>
          <div className="space-y-2">
            <Label>Current Owner (trade to another team)</Label>
            <Select value={newCurrentTeamId} onValueChange={setNewCurrentTeamId}>
              <SelectTrigger>
                <SelectValue />
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
          <div className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
