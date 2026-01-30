"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const POSITIONS = ["QB", "WR", "RB", "TE"] as const;

interface PlayerSearchProps {
  initialSearch?: string;
  initialPosition?: string;
}

export function PlayerSearch({
  initialSearch,
  initialPosition,
}: PlayerSearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [position, setPosition] = useState(initialPosition ?? "");

  const updateSearch = useCallback(
    (q: string, pos: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (pos) params.set("pos", pos);
      router.push(`/players?${params.toString()}`);
    },
    [router]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch(search, position);
  };

  const togglePosition = (pos: string) => {
    const newPos = position === pos ? "" : pos;
    setPosition(newPos);
    updateSearch(search, newPos);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form onSubmit={handleSearch} className="flex flex-1 gap-2">
        <Input
          placeholder="Search players or teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="flex gap-1">
        {POSITIONS.map((pos) => (
          <Button
            key={pos}
            variant={position === pos ? "default" : "outline"}
            size="sm"
            onClick={() => togglePosition(pos)}
          >
            {pos}
          </Button>
        ))}
      </div>
    </div>
  );
}
