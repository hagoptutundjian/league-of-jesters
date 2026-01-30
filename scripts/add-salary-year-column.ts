import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function addSalaryYearColumn() {
  console.log("Adding salary_year column to contracts table...");

  try {
    await db.execute(sql`
      ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS salary_year integer DEFAULT 2025 NOT NULL
    `);
    console.log("✅ Column added successfully!");
  } catch (error) {
    console.error("Error adding column:", error);
  }

  process.exit(0);
}

addSalaryYearColumn();
