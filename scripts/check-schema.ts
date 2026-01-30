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

  // Check contracts table columns
  const columns = await client`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'contracts'
    ORDER BY ordinal_position
  `;

  console.log("Contracts table columns:");
  for (const col of columns) {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  }

  // Check contract count
  const count = await client`SELECT COUNT(*) as count FROM contracts`;
  console.log(`\nContract count: ${count[0].count}`);

  await client.end();
}

main().catch(console.error);
