import {
  ESCALATION_RATE,
  CAP_BY_YEAR,
  PRACTICE_SQUAD_CAP_PCT,
  IR_CAP_PCT,
  LOYALTY_BUMP_YEAR,
  LOYALTY_BUMP_AMOUNT,
  FREE_AGENT_MINIMUM,
  WAIVER_WIRE_TYPES,
  type RosterStatus,
  type AcquisitionType,
} from "@/lib/constants";

const DEFAULT_SALARY_YEAR = 2025;

/**
 * Check if a specific year is the loyalty bump year for a contract.
 * Year 5 of the contract is when the bump applies.
 * Year 1 = yearAcquired, Year 5 = yearAcquired + 4
 */
export function isLoyaltyBumpYear(yearAcquired: number, targetYear: number): boolean {
  // Year 1 is the acquisition year, so year 5 is yearAcquired + 4
  const loyaltyBumpTargetYear = yearAcquired + LOYALTY_BUMP_YEAR - 1;
  return targetYear === loyaltyBumpTargetYear;
}

/**
 * Core salary calculation.
 * Takes a base salary and the year it was entered for (salaryYear).
 * Escalates from salaryYear to targetYear at the given rate.
 *
 * Waiver wire minimum rule: ONLY for waiver wire acquisitions, if a player was
 * acquired for less than $5, their salary goes up to $5 at the start of the next
 * year BEFORE the 15% escalation is applied. This rule does NOT apply to Rookie
 * Draft or Free Agent Auction players.
 *
 * Year 5 loyalty bump: Players kept for 5 years get an additional $5 added
 * ON TOP of the normal 15% escalation in year 5.
 *
 * IMPORTANT: When a salary is manually entered for a specific year (salaryYear),
 * we assume the user has ALREADY factored in any bump that applies to that year.
 * We only apply bumps for FUTURE years when escalating.
 *
 * @param baseSalary - The salary entered by the user (already includes any bump for salaryYear)
 * @param yearAcquired - Year the player was originally acquired (for loyalty bump)
 * @param targetYear - The year to calculate salary for
 * @param rate - Escalation rate (default 15%)
 * @param salaryYear - The year the baseSalary was entered for (default 2025 for legacy data)
 * @param acquisitionType - How the player was acquired (affects $5 minimum rule)
 */
export function calculateSalary(
  baseSalary: number,
  yearAcquired: number,
  targetYear: number,
  rate: number = ESCALATION_RATE,
  salaryYear: number = DEFAULT_SALARY_YEAR,
  acquisitionType?: AcquisitionType
): number {
  // For the salary year, just return the base salary as entered
  // The user has already accounted for any bump in their entered amount
  if (targetYear === salaryYear) {
    return Math.ceil(baseSalary);
  }

  // For years before the salary year, return 0 (shouldn't happen in practice)
  if (targetYear < salaryYear) {
    return 0;
  }

  // For future years, escalate from the salary year
  const yearsFromBase = targetYear - salaryYear;

  let salary = baseSalary;

  // Check if this acquisition type is subject to the $5 minimum rule
  const isWaiverWire = acquisitionType && WAIVER_WIRE_TYPES.includes(acquisitionType);

  // Note: We do NOT add the bump for salaryYear here because the user's
  // entered salary already reflects any bump that applies to that year

  for (let y = 1; y <= yearsFromBase; y++) {
    const currentYear = salaryYear + y;

    // Waiver wire minimum rule: ONLY for waiver wire acquisitions,
    // if salary is below $5, bump it to $5 before applying escalation.
    // This applies at the start of each new year.
    if (isWaiverWire && salary < FREE_AGENT_MINIMUM) {
      salary = FREE_AGENT_MINIMUM;
    }

    // Apply 15% escalation
    salary = salary * (1 + rate);
    // Round up after each year's escalation
    salary = Math.ceil(salary);

    // Check if this year is year 5 of the contract (only for future years)
    if (isLoyaltyBumpYear(yearAcquired, currentYear)) {
      salary += LOYALTY_BUMP_AMOUNT;
    }
  }

  return salary;
}

/**
 * Apply roster status discount to get actual cap hit.
 * Always rounds up.
 */
export function calculateCapHit(
  salary: number,
  rosterStatus: RosterStatus
): number {
  switch (rosterStatus) {
    case "active":
      return salary;
    case "practice_squad":
      return Math.ceil(salary * PRACTICE_SQUAD_CAP_PCT);
    case "injured_reserve":
      return Math.ceil(salary * IR_CAP_PCT);
  }
}

/**
 * Get salary projections for a contract across all future years.
 */
export function getSalaryProjections(
  baseSalary: number,
  yearAcquired: number,
  years: number[] = [2025, 2026, 2027, 2028, 2029, 2030],
  rate: number = ESCALATION_RATE,
  salaryYear: number = DEFAULT_SALARY_YEAR,
  acquisitionType?: AcquisitionType
): Record<number, number> {
  const projections: Record<number, number> = {};
  for (const year of years) {
    projections[year] = calculateSalary(baseSalary, yearAcquired, year, rate, salaryYear, acquisitionType);
  }
  return projections;
}

// ============================================================
// Team Cap Summary
// ============================================================

export interface PlayerCapHit {
  playerId: number;
  playerName: string;
  position: string | null;
  salary2025: number;
  currentSalary: number;
  capHit: number;
  rosterStatus: RosterStatus;
  yearAcquired: number;
  acquisitionType: string;
}

export interface DraftPickCapHit {
  draftPickId: number;
  year: number;
  round: number;
  originalTeam: string;
  salary: number;
}

export interface CapSummary {
  salaryCap: number;
  totalSalary: number;
  draftPickSalary: number;
  capSpace: number;
  rosterCount: number;
  activeCount: number;
  practiceSquadCount: number;
  irCount: number;
  playerBreakdown: PlayerCapHit[];
  draftPickBreakdown: DraftPickCapHit[];
}

export interface ContractForCap {
  id: number;
  playerId: number;
  playerName: string;
  position: string | null;
  salary2025: number;
  yearAcquired: number;
  rosterStatus: RosterStatus;
  acquisitionType: AcquisitionType;
  overrideSalary?: number;
  salaryYear?: number; // The year the salary was entered for (defaults to 2025)
}

/**
 * Calculate a team's full cap situation for a given year.
 */
export function calculateTeamCap(
  contracts: ContractForCap[],
  draftPicks: DraftPickCapHit[],
  targetYear: number,
  salaryCap?: number,
  rate: number = ESCALATION_RATE
): CapSummary {
  const cap = salaryCap ?? CAP_BY_YEAR[targetYear] ?? 250;

  const playerBreakdown: PlayerCapHit[] = contracts.map((contract) => {
    const currentSalary =
      contract.overrideSalary ??
      calculateSalary(contract.salary2025, contract.yearAcquired, targetYear, rate, contract.salaryYear, contract.acquisitionType);
    const capHit = calculateCapHit(currentSalary, contract.rosterStatus);

    return {
      playerId: contract.playerId,
      playerName: contract.playerName,
      position: contract.position,
      salary2025: contract.salary2025,
      currentSalary,
      capHit,
      rosterStatus: contract.rosterStatus,
      yearAcquired: contract.yearAcquired,
      acquisitionType: contract.acquisitionType,
    };
  });

  const totalPlayerSalary = playerBreakdown.reduce(
    (sum, p) => sum + p.capHit,
    0
  );
  const draftPickSalary = draftPicks.reduce((sum, p) => sum + p.salary, 0);
  const totalSalary = totalPlayerSalary + draftPickSalary;

  return {
    salaryCap: cap,
    totalSalary,
    draftPickSalary,
    capSpace: cap - totalSalary,
    rosterCount: contracts.length,
    activeCount: contracts.filter((c) => c.rosterStatus === "active").length,
    practiceSquadCount: contracts.filter(
      (c) => c.rosterStatus === "practice_squad"
    ).length,
    irCount: contracts.filter((c) => c.rosterStatus === "injured_reserve")
      .length,
    playerBreakdown,
    draftPickBreakdown: draftPicks,
  };
}
