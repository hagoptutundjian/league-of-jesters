"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface DraftPickActionsProps {
  pickId: number;
  pickLabel: string; // e.g., "2025 1st Rd Pick"
  round: number;
  currentSalary: number;
  teamSlug: string;
}

export function DraftPickActions({
  pickId,
  pickLabel,
  round,
  currentSalary,
  teamSlug,
}: DraftPickActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [salary, setSalary] = useState(currentSalary.toString());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/draft-picks/${pickId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete pick");
        return;
      }

      toast.success(`${pickLabel} has been deleted`);
      setShowDeleteDialog(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete pick");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSalary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/draft-picks/${pickId}/salary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salary: parseInt(salary, 10) }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update salary");
        return;
      }

      toast.success(`Salary updated to $${salary}`);
      setShowEditDialog(false);
      router.refresh();
    } catch {
      toast.error("Failed to update salary");
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
          {round === 1 && (
            <>
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                Edit Salary
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Pick
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pickLabel}?</DialogTitle>
            <DialogDescription>
              This will permanently remove this draft pick. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit salary dialog (only for 1st round picks) */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Salary for {pickLabel}</DialogTitle>
            <DialogDescription>
              Set a custom salary value for this first round pick.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Salary ($)</label>
            <Input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="mt-1"
              min={1}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSalary}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
