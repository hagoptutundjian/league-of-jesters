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
import { Upload } from "lucide-react";

export function ImportTrades() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState("");
  const router = useRouter();

  const handleImport = async () => {
    if (!data.trim()) {
      toast.error("Please paste trade data to import");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/admin/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      toast.success(`Imported ${result.imported} trades`);
      if (result.skipped > 0) {
        toast.info(`Skipped ${result.skipped} trades`);
      }
      if (result.errors && result.errors.length > 0) {
        console.log("Import errors:", result.errors);
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
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Historical Trades</DialogTitle>
          <DialogDescription>
            Paste your trade history data. Each trade should have two rows (one per team).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Expected format (tab-separated):</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
{`Date	Team	Players/Picks Sent	Players/Picks Received	Season
9/21/2020	King Hags	"1. Kyle Pitts
2. 2022 1st round pick"	"1. Travis Kelce
2. 2022 2nd round pick"	2021
	Cobra	"1. Travis Kelce
2. 2022 2nd round pick"	"1. Kyle Pitts
2. 2022 1st round pick"	2021`}
            </pre>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Notes:</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Date only needs to appear on the first row of each trade</li>
              <li>Team names should match your team names or abbreviations</li>
              <li>Players/picks can be numbered (1. 2. 3.) or plain text</li>
              <li>This import is for historical record only - it will NOT move players/picks</li>
            </ul>
          </div>
          <Textarea
            placeholder="Paste your trade data here..."
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
            {importing ? "Importing..." : "Import Trades"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
