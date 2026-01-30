"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface DraftPickSalaryEditProps {
  pickId: number;
  currentSalary: number;
  teamSlug: string;
}

export function DraftPickSalaryEdit({
  pickId,
  currentSalary,
  teamSlug,
}: DraftPickSalaryEditProps) {
  const [open, setOpen] = useState(false);
  const [salary, setSalary] = useState(currentSalary.toString());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/draft-picks/${pickId}/salary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salary: parseInt(salary, 10) }),
      });

      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1">
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-2">
          <label className="text-xs font-medium">Salary ($)</label>
          <Input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="h-8 text-sm"
            min={1}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={handleSave}
              disabled={loading}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
