/**
 * Rookie draft salary scale per the LOJ Constitution.
 * Maps draft position (round.pick) to base salary.
 */

const ROUND_1_SCALE: Record<number, number> = {
  1: 14,
  2: 12,
  3: 12,
  4: 10,
  5: 10,
  6: 10,
  7: 8,
  8: 8,
  9: 8,
  10: 6,
  11: 6,
  12: 6,
};

export function getRookieSalary(round: number, pickInRound: number): number {
  if (round === 1) {
    return ROUND_1_SCALE[pickInRound] ?? 6;
  }
  if (round === 2) return 4;
  if (round === 3) return 2;
  return 1; // Round 4+
}

/**
 * Draft pick salary values used for cap projection of future picks.
 * These are the salary values assigned to draft slot placeholders.
 */
export const DRAFT_PICK_CAP_VALUES: Record<number, number> = {
  1: 10, // 1st round pick placeholder = $10
  2: 4,  // 2nd round = $4
  3: 2,  // 3rd round = $2
  4: 1,  // 4th round = $1
};

export function getDraftPickCapValue(round: number): number {
  return DRAFT_PICK_CAP_VALUES[round] ?? 1;
}
