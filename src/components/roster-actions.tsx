"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface RosterActionsProps {
  contractId: number;
  playerName: string;
  currentStatus: string;
  teamSlug: string;
}

export function RosterActions({
  contractId,
  playerName,
  currentStatus,
  teamSlug,
}: RosterActionsProps) {
  const [showDropDialog, setShowDropDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamSlug}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
        return;
      }

      toast.success(`${playerName} moved to ${newStatus.replace("_", " ")}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamSlug}/roster`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to drop player");
        return;
      }

      toast.success(`${playerName} has been dropped`);
      setShowDropDialog(false);
      router.refresh();
    } catch {
      toast.error("Failed to drop player");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={loading}>
            ...
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {currentStatus !== "active" && (
            <DropdownMenuItem onClick={() => handleStatusChange("active")}>
              Move to Active
            </DropdownMenuItem>
          )}
          {currentStatus !== "practice_squad" && (
            <DropdownMenuItem
              onClick={() => handleStatusChange("practice_squad")}
            >
              Move to Practice Squad
            </DropdownMenuItem>
          )}
          {currentStatus !== "injured_reserve" && (
            <DropdownMenuItem
              onClick={() => handleStatusChange("injured_reserve")}
            >
              Move to IR
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setShowDropDialog(true)}
          >
            Drop Player
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDropDialog} onOpenChange={setShowDropDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop {playerName}?</DialogTitle>
            <DialogDescription>
              This will remove {playerName} from your roster. This action can be
              undone by re-adding the player (subject to reacquisition rules).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDropDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDrop}
              disabled={loading}
            >
              {loading ? "Dropping..." : "Drop Player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
