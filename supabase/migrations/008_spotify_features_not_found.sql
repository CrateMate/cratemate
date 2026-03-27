-- Stop re-enriching records that Spotify has no data for.
-- A not_found sentinel row tells the client "we already tried — use genre estimates."

ALTER TABLE spotify_features
  ADD COLUMN IF NOT EXISTS not_found boolean DEFAULT false;
