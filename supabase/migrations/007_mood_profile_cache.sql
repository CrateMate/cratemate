-- Shared mood → sound profile cache (AI-determined, shared across all users)

CREATE TABLE IF NOT EXISTS mood_profile_cache (
  mood_text    text PRIMARY KEY,
  valence      numeric,
  energy       numeric,
  danceability numeric,
  acousticness numeric,
  cached_at    timestamptz DEFAULT now()
);
