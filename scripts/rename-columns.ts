import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString, { prepare: false });

  console.log("Renaming base_salary to salary_2025...");
  await client`ALTER TABLE contracts RENAME COLUMN base_salary TO salary_2025`;

  console.log("Renaming original_salary to original_salary_2025...");
  await client`ALTER TABLE contracts RENAME COLUMN original_salary TO original_salary_2025`;

  console.log("Done! Verifying...");

  // Verify
  const columns = await client`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name IN ('salary_2025', 'original_salary_2025')
  `;

  for (const col of columns) {
    console.log(`  - ${col.column_name} exists`);
  }

  await client.end();
}

main().catch(console.error);
