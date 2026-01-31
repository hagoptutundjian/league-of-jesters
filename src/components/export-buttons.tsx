"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonsProps {
  type: "rosters" | "draft-picks" | "player-registry" | "trades" | "rookie-draft" | "all";
}

export function ExportButtons({ type }: ExportButtonsProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/export?type=${type}`);

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to export data");
        return;
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `loj-${type}-${new Date().toISOString().split("T")[0]}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export downloaded successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setLoading(false);
    }
  };

  const labels: Record<typeof type, string> = {
    rosters: "Download Rosters CSV",
    "draft-picks": "Download Draft Picks CSV",
    "player-registry": "Download Registry CSV",
    trades: "Download Trades CSV",
    "rookie-draft": "Download Rookie Draft CSV",
    all: "Download All (ZIP)",
  };

  return (
    <Button onClick={handleExport} disabled={loading} className="w-full">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {labels[type]}
    </Button>
  );
}
