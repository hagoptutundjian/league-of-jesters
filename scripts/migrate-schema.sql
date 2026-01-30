-- Migration script to update contracts table from baseSalary to salary2025
-- Run this in Supabase SQL Editor

-- Check if the old columns exist and new ones don't
DO $$
BEGIN
    -- Rename base_salary to salary_2025 if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'base_salary'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'salary_2025'
    ) THEN
        ALTER TABLE contracts RENAME COLUMN base_salary TO salary_2025;
        RAISE NOTICE 'Renamed base_salary to salary_2025';
    END IF;

    -- Rename original_salary to original_salary_2025 if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'original_salary'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'original_salary_2025'
    ) THEN
        ALTER TABLE contracts RENAME COLUMN original_salary TO original_salary_2025;
        RAISE NOTICE 'Renamed original_salary to original_salary_2025';
    END IF;
END $$;

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contracts'
ORDER BY ordinal_position;
