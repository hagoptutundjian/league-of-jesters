-- Add team customization columns
ALTER TABLE teams ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6366f1';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#818cf8';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
