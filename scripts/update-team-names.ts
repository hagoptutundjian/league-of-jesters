import { db } from "../src/lib/db";
import { teams } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function updateTeamNames() {
  const updates = [
    { oldName: "AGBU Titans", newName: "AGBU", newSlug: "agbu", newAbbreviation: "AGBU" },
    { oldName: "I Am Aram", newName: "TEAM ARAM", newSlug: "team-aram", newAbbreviation: "ARAM" },
    { oldName: "KINGS HAGS", newName: "KING HAGS", newSlug: "king-hags", newAbbreviation: "HAGS" },
  ];

  for (const update of updates) {
    const result = await db
      .update(teams)
      .set({
        name: update.newName,
        slug: update.newSlug,
        abbreviation: update.newAbbreviation,
        updatedAt: new Date(),
      })
      .where(eq(teams.name, update.oldName))
      .returning({ id: teams.id, name: teams.name });

    if (result.length > 0) {
      console.log(`✓ Updated "${update.oldName}" → "${update.newName}"`);
    } else {
      console.log(`⚠ Team "${update.oldName}" not found`);
    }
  }

  console.log("\nDone!");
  process.exit(0);
}

updateTeamNames().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
