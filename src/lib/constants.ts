export const LEAGUE_NAME = "League Of Jesters";

export const CAP_BY_YEAR: Record<number, number> = {
  2025: 300,
  2026: 275,
  2027: 250,
  2028: 250,
  2029: 250,
  2030: 250,
};

export const ESCALATION_RATE = 0.15;
export const ROSTER_SIZE = 32;
export const STARTING_SPOTS = 10;
export const BENCH_SPOTS = 15;
export const PRACTICE_SQUAD_MAX = 5;
export const PRACTICE_SQUAD_CAP_PCT = 0.25;
export const PRACTICE_SQUAD_MAX_YEARS = 2;
export const IR_MAX = 2;
export const IR_CAP_PCT = 0.5;
export const FREE_AGENT_MINIMUM = 5;
export const REACQUISITION_THRESHOLD = 5;
export const LOYALTY_BUMP_YEAR = 5; // Year of contract when bump applies
export const LOYALTY_BUMP_AMOUNT = 5; // $5 added on top of 15% in year 5
export const NUM_TEAMS = 12;

export const STARTING_LINEUP = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  FLEX: 2, // WR/RB/TE
  SUPERFLEX: 1, // QB/WR/RB/TE
};

export const POSITIONS = ["QB", "WR", "RB", "TE"] as const;
export type Position = (typeof POSITIONS)[number];

export const ROSTER_STATUSES = [
  "active",
  "practice_squad",
  "injured_reserve",
] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export const ACQUISITION_TYPES = [
  "auction",
  "rookie_draft",
  "free_agent",
  "faab",
  "trade",
] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

export const SALARY_YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;

export const TEAMS_SEED = [
  { name: "HBK", slug: "hbk", abbreviation: "HBK" },
  { name: "BOMBA", slug: "bomba", abbreviation: "BOM" },
  { name: "DAAA BERJ", slug: "daaa-berj", abbreviation: "BRJ" },
  { name: "AGBU TITANS", slug: "agbu-titans", abbreviation: "AGB" },
  { name: "COBRA KAI", slug: "cobra-kai", abbreviation: "COB" },
  { name: "AWESOMENESS", slug: "awesomeness", abbreviation: "GFY" },
  { name: "USS TUNA", slug: "uss-tuna", abbreviation: "TUN" },
  { name: "KINGS HAGS", slug: "kings-hags", abbreviation: "HAG" },
  { name: "PRIME TIME", slug: "prime-time", abbreviation: "PRI" },
  { name: "I AM ARAM", slug: "i-am-aram", abbreviation: "ARA" },
  { name: "ANDRE", slug: "andre", abbreviation: "AND" },
  { name: "MIKE T", slug: "mike-t", abbreviation: "MIK" },
];
