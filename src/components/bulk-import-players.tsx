"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface ParsedPlayer {
  name: string;
  yearAcquired: number;
}

export function BulkImportPlayers() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState("");
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [parseError, setParseError] = useState("");
  const router = useRouter();

  const parseData = () => {
    setParseError("");
    const lines = rawData.trim().split("\n").filter(line => line.trim());

    if (lines.length === 0) {
      setParseError("No data to parse");
      return;
    }

    const players: ParsedPlayer[] = [];
    const errors: string[] = [];

    // Detect delimiter
    const delimiter = lines[0].includes("\t") ? "\t" : ",";

    lines.forEach((line, index) => {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));

      // Skip header row if detected
      if (index === 0 && (parts[0].toLowerCase().includes("name") || parts[0].toLowerCase().includes("player"))) {
        return;
      }

      if (parts.length < 2) {
        errors.push(`Line ${index + 1}: Need Name and Year`);
        return;
      }

      const name = parts[0];
      const yearAcquired = parseInt(parts[1]);

      if (!name) {
        errors.push(`Line ${index + 1}: Missing player name`);
        return;
      }

      if (isNaN(yearAcquired) || yearAcquired < 2015 || yearAcquired > 2025) {
        errors.push(`Line ${index + 1}: Invalid year "${parts[1]}" (must be 2015-2025)`);
        return;
      }

      players.push({
        name,
        yearAcquired,
      });
    });

    if (errors.length > 0) {
      setParseError(errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ""));
    }

    setParsedPlayers(players);
  };

  const handleImport = async () => {
    if (parsedPlayers.length === 0) {
      toast.error("No players to import");
      return;
    }

    setLoading(true);

    try {
      // Use bulk import endpoint (PUT) instead of one-by-one POST
      const res = await fetch("/api/admin/player-registry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: parsedPlayers,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.imported > 0) {
          toast.success(`Imported ${data.imported} players${data.skipped > 0 ? ` (${data.skipped} already existed)` : ""}`);
        } else {
          toast.info("All players already exist in the registry");
        }
        setRawData("");
        setParsedPlayers([]);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || "Failed to import players");
      }
    } catch {
      toast.error("Failed to import players");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Bulk Import
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bulk Import Players</CardTitle>
            <CardDescription>
              Paste player names and year acquired (one per line)
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Player Data (Name, Year)</Label>
          <Textarea
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            placeholder={`Patrick Mahomes, 2020
Josh Allen, 2021
Tyreek Hill, 2019
Travis Kelce, 2018`}
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Format: Name, Year. One player per line.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={parseData}>
          Preview Import
        </Button>

        {parseError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
            {parseError}
          </div>
        )}

        {parsedPlayers.length > 0 && (
          <div className="space-y-2">
            <Label>Preview ({parsedPlayers.length} players)</Label>
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-center">Year Acquired</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPlayers.map((p, i) => (
                    <tr key={i}>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-center">{p.yearAcquired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || parsedPlayers.length === 0}
          >
            {loading ? "Importing..." : `Import ${parsedPlayers.length} Players`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
