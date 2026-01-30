/**
 * Data import script for migrating Google Sheets data to the database.
 *
 * Usage:
 *   1. Export each team tab from the Google Sheet as CSV
 *   2. Place CSVs in a directory
 *   3. Run: npx tsx scripts/import-spreadsheet.ts <csv-directory>
 *
 * This script:
 *   - Creates team records
 *   - Parses player names, positions, year acquired, and 2025 salary
 *   - Stores the 2025 salary directly (no reverse calculation needed)
 *   - Creates player and contract records
 *   - Seeds league settings and draft pick salary scale
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const TEAMS = [
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

const ESCALATION_RATE = 0.15;
const LOYALTY_BUMP_YEAR = 5;
const LOYALTY_BUMP_AMOUNT = 5;
const BASE_YEAR = 2025;

/**
 * Calculate salary for future years based on 2025 salary.
 * For 2025, returns the stored salary directly.
 * For future years, escalates from 2025.
 */
function calculateSalary(
  salary2025: number,
  yearAcquired: number,
  targetYear: number
): number {
  // For 2025, just return the stored salary
  if (targetYear === BASE_YEAR) {
    return Math.round(salary2025);
  }
  // For years before 2025, return 0
  if (targetYear < BASE_YEAR) {
    return 0;
  }
  // For future years, escalate from 2025
  const yearsFromBase = targetYear - BASE_YEAR;
  const contractYearsBy2025 = BASE_YEAR - yearAcquired;
  let salary = salary2025;
  for (let y = 1; y <= yearsFromBase; y++) {
    salary = salary * (1 + ESCALATION_RATE);
    const contractYear = contractYearsBy2025 + y;
    if (contractYear === LOYALTY_BUMP_YEAR) {
      salary += LOYALTY_BUMP_AMOUNT;
    }
  }
  return Math.round(salary);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });

  console.log("Connected to database");

  // 1. Seed league settings
  console.log("\n--- Seeding league settings ---");
  const settings = [
    { key: "salary_cap_2025", value: "300", description: "Salary cap for 2025" },
    { key: "salary_cap_2026", value: "275", description: "Salary cap for 2026" },
    { key: "salary_cap_2027", value: "250", description: "Salary cap for 2027" },
    { key: "salary_cap_2028", value: "250", description: "Salary cap for 2028" },
    { key: "salary_cap_2029", value: "250", description: "Salary cap for 2029" },
    { key: "salary_cap_2030", value: "250", description: "Salary cap for 2030" },
    { key: "escalation_rate", value: "0.15", description: "Annual salary escalation rate" },
    { key: "roster_size", value: "32", description: "Maximum roster spots" },
    { key: "practice_squad_max", value: "5", description: "Max practice squad spots" },
    { key: "practice_squad_cap_pct", value: "0.25", description: "PS cap hit percentage" },
    { key: "ir_max", value: "2", description: "Max IR spots" },
    { key: "ir_cap_pct", value: "0.50", description: "IR cap hit percentage" },
    { key: "free_agent_minimum", value: "5", description: "Minimum free agent salary" },
    { key: "loyalty_bump_year", value: "5", description: "Year of contract when loyalty bump applies" },
    { key: "loyalty_bump_amount", value: "5", description: "Dollar amount added in loyalty bump year" },
  ];

  for (const setting of settings) {
    await db
      .insert(schema.leagueSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: schema.leagueSettings.key,
        set: { value: setting.value, description: setting.description },
      });
  }
  console.log(`Seeded ${settings.length} league settings`);

  // 2. Seed draft pick salary scale
  console.log("\n--- Seeding draft pick salary scale ---");
  const scaleEntries = [
    { round: 1, pickFrom: 1, pickTo: 1, baseSalary: "14" },
    { round: 1, pickFrom: 2, pickTo: 3, baseSalary: "12" },
    { round: 1, pickFrom: 4, pickTo: 6, baseSalary: "10" },
    { round: 1, pickFrom: 7, pickTo: 9, baseSalary: "8" },
    { round: 1, pickFrom: 10, pickTo: 12, baseSalary: "6" },
    { round: 2, pickFrom: 1, pickTo: 12, baseSalary: "4" },
    { round: 3, pickFrom: 1, pickTo: 12, baseSalary: "2" },
    { round: 4, pickFrom: 1, pickTo: 12, baseSalary: "1" },
  ];

  for (const entry of scaleEntries) {
    await db
      .insert(schema.draftPickSalaryScale)
      .values(entry)
      .onConflictDoNothing();
  }
  console.log(`Seeded ${scaleEntries.length} salary scale entries`);

  // 3. Create teams
  console.log("\n--- Creating teams ---");
  for (const team of TEAMS) {
    await db
      .insert(schema.teams)
      .values(team)
      .onConflictDoNothing();
  }
  console.log(`Created ${TEAMS.length} teams`);

  // 4. Import sample data for validation
  console.log("\n--- Import instructions ---");
  console.log("To import player data from the spreadsheet:");
  console.log("1. Export each team tab as CSV from Google Sheets");
  console.log("2. Each CSV should have columns: Player, Position, Year Acquired, 2025 Salary");
  console.log("3. Use the parseTeamCSV function below to process each file");
  console.log("");
  console.log("Example CSV row: Lamar Jackson,QB,2022,99");
  console.log("  -> 2025 salary = $99 (stored directly)");
  console.log("  -> 2026 salary = $99 * 1.15 = $114");
  console.log("  -> Year 5 loyalty bump adds $5 on top of 15% in year 5");
  console.log("");

  // Example salary projections
  console.log("Sample salary projections (verification):");
  const examples = [
    { name: "Lamar Jackson", salary2025: 99, yearAcq: 2022 },
    { name: "Josh Allen", salary2025: 112, yearAcq: 2022 },
    { name: "Ja'Marr Chase", salary2025: 48, yearAcq: 2022 },
    { name: "Patrick Mahomes", salary2025: 111, yearAcq: 2022 },
    { name: "Drake Maye", salary2025: 12, yearAcq: 2024 },
  ];

  for (const ex of examples) {
    const s2025 = calculateSalary(ex.salary2025, ex.yearAcq, 2025);
    const s2026 = calculateSalary(ex.salary2025, ex.yearAcq, 2026);
    const s2027 = calculateSalary(ex.salary2025, ex.yearAcq, 2027);
    const s2030 = calculateSalary(ex.salary2025, ex.yearAcq, 2030);
    console.log(
      `  ${ex.name}: 2025=$${s2025}, 2026=$${s2026}, 2027=$${s2027}, 2030=$${s2030}`
    );
  }

  console.log("\n--- Import complete ---");
  await client.end();
}

/**
 * Parse a team CSV file and import players/contracts.
 * This function can be called for each team's exported CSV.
 *
 * The 2025 salary from the spreadsheet is stored directly - no reverse calculation needed.
 */
export async function parseTeamCSV(
  db: ReturnType<typeof drizzle>,
  teamSlug: string,
  csvRows: { name: string; position: string; yearAcquired: number; salary2025: number; status?: string }[]
) {
  // Look up team
  const team = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.slug, teamSlug))
    .limit(1);

  if (team.length === 0) {
    console.error(`Team not found: ${teamSlug}`);
    return;
  }

  const teamId = team[0].id;

  for (const row of csvRows) {
    // Find or create player
    let playerId: number;
    const existing = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.name, row.name))
      .limit(1);

    if (existing.length > 0) {
      playerId = existing[0].id;
    } else {
      const newPlayer = await db
        .insert(schema.players)
        .values({
          name: row.name,
          position: row.position as "QB" | "WR" | "RB" | "TE",
        })
        .returning({ id: schema.players.id });
      playerId = newPlayer[0].id;
    }

    // Store the 2025 salary directly
    await db
      .insert(schema.contracts)
      .values({
        playerId,
        teamId,
        salary2025: row.salary2025.toString(),
        yearAcquired: row.yearAcquired,
        acquisitionType: "auction",
        rosterStatus: (row.status as "active" | "practice_squad" | "injured_reserve") || "active",
        originalSalary2025: row.salary2025.toString(),
      })
      .onConflictDoNothing();

    console.log(`  Added ${row.name}: $${row.salary2025} (2025), acquired ${row.yearAcquired}`);
  }

  console.log(`  Imported ${csvRows.length} players for ${teamSlug}`);
}

main().catch(console.error);
