-- Add artist type + band member dates to artist_metadata cache

ALTER TABLE artist_metadata
  ADD COLUMN IF NOT EXISTS artist_type text,       -- 'person' | 'group' | 'other'
  ADD COLUMN IF NOT EXISTS members     jsonb;      -- [{name, birth_year, birth_month, birth_day, death_year, death_month, death_day}]

-- Index for reco engine: find group artists quickly
CREATE INDEX IF NOT EXISTS idx_artist_metadata_type ON artist_metadata (artist_type);
