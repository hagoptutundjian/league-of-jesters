import {
  ROSTER_SIZE,
  PRACTICE_SQUAD_MAX,
  PRACTICE_SQUAD_MAX_YEARS,
  IR_MAX,
  type RosterStatus,
} from "@/lib/constants";
import type { CapSummary } from "./engine";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DroppedPlayerRecord {
  salaryAtDrop: number;
  canReacquireCheaper: boolean;
}

/**
 * Validate adding a player to a team roster.
 */
export function validateAddPlayer(
  teamCap: CapSummary,
  proposedCapHit: number,
  proposedStatus: RosterStatus,
  proposedSalary: number,
  playerHistory: DroppedPlayerRecord | null,
  isRookieDraft: boolean = false
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Cap space
  if (teamCap.capSpace - proposedCapHit < 0) {
    errors.push(
      `Insufficient cap space. Available: $${teamCap.capSpace}, Required: $${proposedCapHit}`
    );
  }

  // Roster size
  if (teamCap.rosterCount >= ROSTER_SIZE) {
    errors.push(`Roster is full (${ROSTER_SIZE} players maximum)`);
  }

  // Practice squad limits
  if (
    proposedStatus === "practice_squad" &&
    teamCap.practiceSquadCount >= PRACTICE_SQUAD_MAX
  ) {
    errors.push(
      `Practice squad is full (${PRACTICE_SQUAD_MAX} players maximum)`
    );
  }

  // IR limits
  if (proposedStatus === "injured_reserve" && teamCap.irCount >= IR_MAX) {
    errors.push(`IR is full (${IR_MAX} players maximum)`);
  }

  // Reacquisition rule
  if (playerHistory && !playerHistory.canReacquireCheaper) {
    if (proposedSalary < playerHistory.salaryAtDrop) {
      errors.push(
        `Reacquisition rule: Player was previously at $${playerHistory.salaryAtDrop}. ` +
          `Cannot reacquire for less than that amount.`
      );
    }
  }

  // Warnings
  if (teamCap.capSpace - proposedCapHit < 10) {
    warnings.push(
      `Low cap space warning: Only $${teamCap.capSpace - proposedCapHit} remaining after this move`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate changing a player's roster status.
 */
export function validateStatusChange(
  teamCap: CapSummary,
  currentStatus: RosterStatus,
  newStatus: RosterStatus,
  currentCapHit: number,
  newCapHit: number,
  practiceSquadYears: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (currentStatus === newStatus) {
    errors.push("Player is already in this status");
    return { valid: false, errors, warnings };
  }

  // Moving to practice squad
  if (newStatus === "practice_squad") {
    if (teamCap.practiceSquadCount >= PRACTICE_SQUAD_MAX) {
      errors.push(
        `Practice squad is full (${PRACTICE_SQUAD_MAX} players maximum)`
      );
    }
    if (practiceSquadYears >= PRACTICE_SQUAD_MAX_YEARS) {
      errors.push(
        `Player has used maximum practice squad eligibility (${PRACTICE_SQUAD_MAX_YEARS} years)`
      );
    }
  }

  // Moving to IR
  if (newStatus === "injured_reserve") {
    if (teamCap.irCount >= IR_MAX) {
      errors.push(`IR is full (${IR_MAX} players maximum)`);
    }
  }

  // Cap impact check (moving from PS/IR to active increases cap hit)
  const capDifference = newCapHit - currentCapHit;
  if (capDifference > 0 && teamCap.capSpace < capDifference) {
    errors.push(
      `Insufficient cap space for status change. Need $${capDifference} more.`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate dropping a player.
 */
export function validateDropPlayer(
  teamCap: CapSummary,
  veteranCountAfterDrop: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (veteranCountAfterDrop < 10) {
    warnings.push(
      `Warning: Dropping this player leaves you with ${veteranCountAfterDrop} veterans (minimum 10 required by July 31)`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
