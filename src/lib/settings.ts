import { db } from "@/lib/db";
import { leagueSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentSeason(): Promise<number> {
  const setting = await db
    .select({ value: leagueSettings.value })
    .from(leagueSettings)
    .where(eq(leagueSettings.key, "current_season"))
    .limit(1);

  if (setting.length > 0) {
    return parseInt(setting[0].value, 10);
  }

  // Default to 2025 if not set
  return 2025;
}

export function getSalaryYearsForDisplay(currentSeason: number): number[] {
  // Return current season + 2 subsequent years
  return [currentSeason, currentSeason + 1, currentSeason + 2];
}
