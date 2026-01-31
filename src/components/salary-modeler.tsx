"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CAP_BY_YEAR: Record<number, number> = {
  2025: 300,
  2026: 275,
  2027: 250,
  2028: 250,
  2029: 250,
  2030: 250,
};

const DRAFT_PICK_VALUES: Record<number, number> = {
  1: 10,
  2: 5,
  3: 3,
  4: 1,
};

const ESCALATION_RATE = 0.15;
const LOYALTY_BUMP_YEAR = 5;
const LOYALTY_BUMP_AMOUNT = 5;
const DEFAULT_SALARY_YEAR = 2025;

/**
 * Check if a specific year is the loyalty bump year for a contract.
 * Year 5 of the contract is when the bump applies.
 */
function isLoyaltyBumpYear(yearAcquired: number, targetYear: number): boolean {
  const loyaltyBumpTargetYear = yearAcquired + LOYALTY_BUMP_YEAR - 1;
  return targetYear === loyaltyBumpTargetYear;
}

/**
 * Calculate salary for a given year, using salaryYear as the base.
 * The baseSalary is the salary for salaryYear, and we escalate from there.
 */
function calcSalary(baseSalary: number, yearAcquired: number, targetYear: number, salaryYear: number = DEFAULT_SALARY_YEAR): number {
  // For the salary year, just return the base salary (plus bump if applicable)
  if (targetYear === salaryYear) {
    const salary = Math.ceil(baseSalary);
    if (isLoyaltyBumpYear(yearAcquired, targetYear)) {
      return salary + LOYALTY_BUMP_AMOUNT;
    }
    return salary;
  }

  // For years before the salary year, return 0
  if (targetYear < salaryYear) {
    return 0;
  }

  // For future years, escalate from the salary year
  const yearsFromBase = targetYear - salaryYear;
  let salary = baseSalary;

  // Check if salaryYear itself is a bump year
  if (isLoyaltyBumpYear(yearAcquired, salaryYear)) {
    salary += LOYALTY_BUMP_AMOUNT;
  }

  for (let y = 1; y <= yearsFromBase; y++) {
    const currentYear = salaryYear + y;
    salary = salary * (1 + ESCALATION_RATE);
    salary = Math.ceil(salary);
    if (isLoyaltyBumpYear(yearAcquired, currentYear)) {
      salary += LOYALTY_BUMP_AMOUNT;
    }
  }

  return salary;
}

function calcCapHit(salary: number, status: string): number {
  if (status === "practice_squad") return Math.round(salary * 0.25);
  if (status === "injured_reserve") return Math.round(salary * 0.5);
  return salary;
}

export interface ModelPlayer {
  contractId: number;
  playerName: string;
  position: string | null;
  salary2025: number;
  yearAcquired: number;
  rosterStatus: string;
  salaryYear?: number;
}

export interface ModelDraftPick {
  id: number;
  year: number;
  round: number;
  pickNumber: number | null;
  originalTeamId: number;
  originalTeamName?: string;
  salaryOverride: number | null;
}

interface SalaryModelerProps {
  players: ModelPlayer[];
  draftPicks?: ModelDraftPick[];
  currentSeason?: number;
}

export function SalaryModeler({ players, draftPicks = [], currentSeason = 2025 }: SalaryModelerProps) {
  const [open, setOpen] = useState(false);
  const [droppedPlayerIds, setDroppedPlayerIds] = useState<Set<number>>(new Set());
  const [droppedPickIds, setDroppedPickIds] = useState<Set<number>>(new Set());
  const [statusChanges, setStatusChanges] = useState<Map<number, string>>(new Map());

  // Only show current year + next 2 years
  const displayYears = [currentSeason, currentSeason + 1, currentSeason + 2];

  const toggleDropPlayer = (contractId: number) => {
    setDroppedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  const toggleDropPick = (pickId: number) => {
    setDroppedPickIds((prev) => {
      const next = new Set(prev);
      if (next.has(pickId)) {
        next.delete(pickId);
      } else {
        next.add(pickId);
      }
      return next;
    });
  };

  const changeStatus = (contractId: number, newStatus: string) => {
    setStatusChanges((prev) => {
      const next = new Map(prev);
      next.set(contractId, newStatus);
      return next;
    });
  };

  const resetAll = () => {
    setDroppedPlayerIds(new Set());
    setDroppedPickIds(new Set());
    setStatusChanges(new Map());
  };

  const { currentCap, modeledCap } = useMemo(() => {
    const result: Record<
      number,
      { current: number; modeled: number; savings: number }
    > = {};

    for (const year of displayYears) {
      let currentTotal = 0;
      let modeledTotal = 0;

      // Calculate player salaries
      for (const p of players) {
        const salary = calcSalary(p.salary2025, p.yearAcquired, year, p.salaryYear);
        const currentHit = calcCapHit(salary, p.rosterStatus);
        currentTotal += currentHit;

        if (!droppedPlayerIds.has(p.contractId)) {
          const effectiveStatus =
            statusChanges.get(p.contractId) ?? p.rosterStatus;
          modeledTotal += calcCapHit(salary, effectiveStatus);
        }
      }

      // Calculate draft pick values
      for (const pick of draftPicks) {
        if (pick.year === year) {
          const pickValue = pick.salaryOverride ?? (DRAFT_PICK_VALUES[pick.round] || 0);
          currentTotal += pickValue;

          if (!droppedPickIds.has(pick.id)) {
            modeledTotal += pickValue;
          }
        }
      }

      result[year] = {
        current: currentTotal,
        modeled: modeledTotal,
        savings: currentTotal - modeledTotal,
      };
    }

    return {
      currentCap: result,
      modeledCap: result,
    };
  }, [players, draftPicks, droppedPlayerIds, droppedPickIds, statusChanges, displayYears]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Salary Modeler
      </Button>
    );
  }

  const hasChanges = droppedPlayerIds.size > 0 || droppedPickIds.size > 0 || statusChanges.size > 0;

  // Filter draft picks to only show those in display years
  const relevantPicks = draftPicks.filter((p) => displayYears.includes(p.year));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Salary Modeler</CardTitle>
            <CardDescription>
              Simulate roster changes to see the cap impact
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                resetAll();
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cap impact summary */}
        {hasChanges && (
          <>
            <div className="overflow-x-auto rounded-md border bg-muted/50 p-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    {displayYears.map((y) => (
                      <TableHead key={y} className="text-right">
                        {y}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Current</TableCell>
                    {displayYears.map((y) => (
                      <TableCell key={y} className="text-right">
                        ${currentCap[y].current}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Modeled</TableCell>
                    {displayYears.map((y) => (
                      <TableCell key={y} className="text-right font-medium">
                        ${currentCap[y].modeled}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-green-600">
                      Savings
                    </TableCell>
                    {displayYears.map((y) => (
                      <TableCell
                        key={y}
                        className="text-right font-medium text-green-600"
                      >
                        +${currentCap[y].savings}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">New Space</TableCell>
                    {displayYears.map((y) => {
                      const cap = CAP_BY_YEAR[y] ?? 250;
                      const space = cap - currentCap[y].modeled;
                      return (
                        <TableCell
                          key={y}
                          className={`text-right font-bold ${
                            space >= 0 ? "text-green-600" : "text-destructive"
                          }`}
                        >
                          {space >= 0 ? `$${space}` : `-$${Math.abs(space)}`}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Separator />
          </>
        )}

        {/* Tabs for Players and Draft Picks */}
        <Tabs defaultValue="players" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="players">
              Players ({players.length})
            </TabsTrigger>
            <TabsTrigger value="picks">
              Draft Picks ({relevantPicks.length})
            </TabsTrigger>
          </TabsList>

          {/* Players Tab */}
          <TabsContent value="players" className="mt-4">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">{currentSeason}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((p) => {
                    const isDropped = droppedPlayerIds.has(p.contractId);
                    const effectiveStatus =
                      statusChanges.get(p.contractId) ?? p.rosterStatus;
                    const salary = calcSalary(p.salary2025, p.yearAcquired, currentSeason, p.salaryYear);
                    const capHit = calcCapHit(salary, effectiveStatus);

                    return (
                      <TableRow
                        key={p.contractId}
                        className={isDropped ? "opacity-40 line-through" : ""}
                      >
                        <TableCell className="font-medium">
                          {p.playerName}
                        </TableCell>
                        <TableCell>{p.position}</TableCell>
                        <TableCell>
                          {isDropped ? (
                            <Badge variant="destructive">DROPPED</Badge>
                          ) : effectiveStatus !== p.rosterStatus ? (
                            <Badge variant="secondary">
                              {effectiveStatus === "practice_squad"
                                ? "PS"
                                : effectiveStatus === "injured_reserve"
                                  ? "IR"
                                  : "Active"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {p.rosterStatus === "practice_squad"
                                ? "PS"
                                : p.rosterStatus === "injured_reserve"
                                  ? "IR"
                                  : "Active"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ${isDropped ? 0 : capHit}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant={isDropped ? "default" : "destructive"}
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => toggleDropPlayer(p.contractId)}
                            >
                              {isDropped ? "Undo" : "Drop"}
                            </Button>
                            {!isDropped && (
                              <>
                                {effectiveStatus !== "practice_squad" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() =>
                                      changeStatus(p.contractId, "practice_squad")
                                    }
                                  >
                                    PS
                                  </Button>
                                )}
                                {effectiveStatus !== "injured_reserve" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() =>
                                      changeStatus(p.contractId, "injured_reserve")
                                    }
                                  >
                                    IR
                                  </Button>
                                )}
                                {effectiveStatus !== "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() =>
                                      changeStatus(p.contractId, "active")
                                    }
                                  >
                                    ACT
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Draft Picks Tab */}
          <TabsContent value="picks" className="mt-4">
            {relevantPicks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No draft picks in the next 3 years
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pick</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Cap Hit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relevantPicks.map((pick) => {
                      const isDropped = droppedPickIds.has(pick.id);
                      const pickValue = pick.salaryOverride ?? (DRAFT_PICK_VALUES[pick.round] || 0);

                      return (
                        <TableRow
                          key={pick.id}
                          className={isDropped ? "opacity-40 line-through" : ""}
                        >
                          <TableCell className="font-medium">
                            Round {pick.round}
                            {pick.originalTeamName && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({pick.originalTeamName})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{pick.year}</TableCell>
                          <TableCell className="text-right">
                            ${isDropped ? 0 : pickValue}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={isDropped ? "default" : "destructive"}
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => toggleDropPick(pick.id)}
                            >
                              {isDropped ? "Undo" : "Trade"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
