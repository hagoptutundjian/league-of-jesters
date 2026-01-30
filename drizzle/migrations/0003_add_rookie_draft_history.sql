-- Create rookie draft history table
CREATE TABLE IF NOT EXISTS rookie_draft_history (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  pick INTEGER NOT NULL,
  overall_pick TEXT NOT NULL,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  player_name TEXT NOT NULL,
  player_id INTEGER REFERENCES players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(year, round, pick)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rookie_draft_year ON rookie_draft_history(year);
CREATE INDEX IF NOT EXISTS idx_rookie_draft_team ON rookie_draft_history(team_id);
