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
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const router = useRouter();

  const handleImport = async () => {
    if (!data.trim()) {
      toast.error("Please paste trade data to import");
      return;
    }

    setImporting(true);
    setImportResult(null);
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

      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors || [],
      });

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} trades`);
      }
      if (result.skipped > 0 && result.errors?.length > 0) {
        toast.error(`Skipped ${result.skipped} trades - see errors below`);
      }

      // Only close if mostly successful
      if (result.imported > 0 && result.skipped === 0) {
        setOpen(false);
        setData("");
        setImportResult(null);
      }
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Import Historical Trades</DialogTitle>
          <DialogDescription>
            Paste your trade history data. Each trade should have two rows (one per team).
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium mb-1">Show format instructions</summary>
            <div className="mt-2 space-y-2">
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
{`Date	Team	Players/Picks Sent	Players/Picks Received	Season
9/21/2020	King Hags	"1. Kyle Pitts
2. 2022 1st round pick"	"1. Travis Kelce
2. 2022 2nd round pick"	2021
	Cobra	"1. Travis Kelce
2. 2022 2nd round pick"	"1. Kyle Pitts
2. 2022 1st round pick"	2021`}
              </pre>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Date only needs to appear on the first row of each trade</li>
                <li>Team names should match your team names or abbreviations</li>
                <li>Players/picks can be numbered (1. 2. 3.) or plain text</li>
                <li>This import is for historical record only - it will NOT move players/picks</li>
              </ul>
            </div>
          </details>
          <Textarea
            placeholder="Paste your trade data here..."
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="font-mono text-sm min-h-[300px]"
          />
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.split('\n').filter(l => l.trim()).length} lines pasted
            </p>
          )}
          {importResult && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  Imported: {importResult.imported}
                </span>
                <span className="text-red-600 dark:text-red-400">
                  Skipped: {importResult.skipped}
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Errors (first 10):
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4">
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
