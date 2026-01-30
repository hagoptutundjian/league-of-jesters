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
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface DeleteTradeButtonProps {
  tradeId: number;
  tradeDate: string;
  teamAbbrs: string[];
}

export function DeleteTradeButton({
  tradeId,
  tradeDate,
  teamAbbrs,
}: DeleteTradeButtonProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete trade");
      }

      toast.success("Trade deleted successfully");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Trade</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this trade? This will remove the trade
            record but will NOT reverse the player/pick transfers.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">
              {teamAbbrs.join(" ↔ ")} Trade
            </p>
            <p className="text-sm text-muted-foreground">{tradeDate}</p>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
            ⚠️ If you need to reverse the transfers, you&apos;ll need to record a new
            trade moving the assets back.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
