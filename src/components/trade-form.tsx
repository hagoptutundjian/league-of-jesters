"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TradeFormProps {
  teams: { id: number; name: string; slug: string }[];
}

interface TradeAssetInput {
  description: string;
  fromTeamId: string;
  toTeamId: string;
}

export function TradeForm({ teams }: TradeFormProps) {
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [season, setSeason] = useState("2025");
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<TradeAssetInput[]>([
    { description: "", fromTeamId: "", toTeamId: "" },
    { description: "", fromTeamId: "", toTeamId: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const addAsset = () => {
    setAssets([...assets, { description: "", fromTeamId: "", toTeamId: "" }]);
  };

  const removeAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
  };

  const updateAsset = (
    index: number,
    field: keyof TradeAssetInput,
    value: string
  ) => {
    const updated = [...assets];
    updated[index] = { ...updated[index], [field]: value };
    setAssets(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validAssets = assets.filter(
      (a) => a.description && a.fromTeamId && a.toTeamId
    );

    if (validAssets.length === 0) {
      toast.error("At least one trade asset is required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeDate,
          season: Number(season),
          notes,
          assets: validAssets.map((a) => ({
            description: a.description,
            fromTeamId: Number(a.fromTeamId),
            toTeamId: Number(a.toTeamId),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to record trade");
        return;
      }

      toast.success("Trade recorded successfully");
      router.push("/trades");
      router.refresh();
    } catch {
      toast.error("Failed to record trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Trade Date</Label>
            <Input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Season</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2021, 2022, 2023, 2024, 2025].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Assets</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAsset}>
              + Add Asset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assets.map((asset, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-4"
            >
              <div className="space-y-1">
                <Label className="text-xs">Player / Pick</Label>
                <Input
                  value={asset.description}
                  onChange={(e) =>
                    updateAsset(index, "description", e.target.value)
                  }
                  placeholder="e.g. Patrick Mahomes or 2026 1st"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From Team</Label>
                <Select
                  value={asset.fromTeamId}
                  onValueChange={(v) => updateAsset(index, "fromTeamId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
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
              <div className="space-y-1">
                <Label className="text-xs">To Team</Label>
                <Select
                  value={asset.toTeamId}
                  onValueChange={(v) => updateAsset(index, "toTeamId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
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
              <div className="flex items-end">
                {assets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAsset(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Recording..." : "Record Trade"}
      </Button>
    </form>
  );
}
