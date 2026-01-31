"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AcquisitionTypeEditorProps {
  contractId: number;
  currentType: string;
}

const ACQUISITION_TYPE_LABELS: Record<string, string> = {
  rookie_draft: "Rookie Draft",
  free_agent_auction: "FA Auction",
  waiver_wire: "Waiver Wire",
  auction: "Auction",
  free_agent: "Free Agent",
  faab: "FAAB",
  trade: "Trade",
};

export function AcquisitionTypeEditor({
  contractId,
  currentType,
}: AcquisitionTypeEditorProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (newType: string) => {
    if (newType === currentType) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acquisitionType: newType }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update acquisition type");
        return;
      }

      toast.success("Acquisition type updated");
      router.refresh();
    } catch {
      toast.error("Failed to update acquisition type");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      value={currentType}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className="h-7 w-[120px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="rookie_draft">Rookie Draft</SelectItem>
        <SelectItem value="free_agent_auction">FA Auction</SelectItem>
        <SelectItem value="waiver_wire">Waiver Wire</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Simple display component for non-commissioners
export function AcquisitionTypeDisplay({ type }: { type: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      {ACQUISITION_TYPE_LABELS[type] || type}
    </span>
  );
}
