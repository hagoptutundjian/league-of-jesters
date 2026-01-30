-- Add salary_year column to contracts table
-- This column stores the year the salary was entered for (defaults to 2025 for legacy data)
ALTER TABLE "contracts" ADD COLUMN "salary_year" integer DEFAULT 2025 NOT NULL;
