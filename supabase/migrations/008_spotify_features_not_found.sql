-- Fix silent upsert failures in spotify_features:
-- track_count and track_features were added to the code but never to the schema,
-- causing every enrichment write to fail silently.
-- not_found prevents the enrichment loop from re-running on every refresh
-- for records that genuinely have no Spotify/ReccoBeats data.

ALTER TABLE spotify_features
  ADD COLUMN IF NOT EXISTS track_count    integer,
  ADD COLUMN IF NOT EXISTS track_features jsonb,
  ADD COLUMN IF NOT EXISTS not_found      boolean DEFAULT false;
