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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface ImportRookieDraftProps {
  teams: Team[];
}

export function ImportRookieDraft({ teams }: ImportRookieDraftProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState("");
  const router = useRouter();

  const handleImport = async () => {
    if (!data.trim()) {
      toast.error("Please paste draft data to import");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/admin/rookie-draft/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      toast.success(`Imported ${result.imported} draft picks`);
      if (result.skipped > 0) {
        toast.info(`Skipped ${result.skipped} duplicate or invalid rows`);
      }
      setOpen(false);
      setData("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Import Draft Data</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Rookie Draft History</DialogTitle>
          <DialogDescription>
            Paste your draft data in tab-separated format. Expected columns:
            Year, Pick (e.g., 1.01), Team abbreviation, Player name
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Example format:</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`Year	Pick	Team	Player
2022	1.01	AGBU	Breece Hall
2022	1.02	Shake	Kenneth Walker
2022	2.01	Cobra	Jahan Dotson`}
            </pre>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Available team abbreviations:</p>
            <p className="text-xs">{teams.map((t) => t.abbreviation).join(", ")}</p>
          </div>
          <Textarea
            placeholder="Paste your draft data here..."
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
