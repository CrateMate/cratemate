-- Phase 0: Schema migrations for Wantlist, Fast Import, Caching, and Offline features

-- Shared by Features 1 & 2
ALTER TABLE records ADD COLUMN IF NOT EXISTS master_id bigint;
ALTER TABLE records ADD COLUMN IF NOT EXISTS import_stage integer DEFAULT 0;
-- 0 = bare minimum, 1 = enriched metadata, 2 = Spotify features done

-- Feature 3: TTL on existing cache tables
ALTER TABLE discogs_metadata_cache
  ADD COLUMN IF NOT EXISTS cached_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '90 days'),
  ADD COLUMN IF NOT EXISTS master_id  bigint,
  ADD COLUMN IF NOT EXISTS genres     text,
  ADD COLUMN IF NOT EXISTS styles     text;

ALTER TABLE artist_metadata
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '365 days');

-- Feature 3: new shared cache tables (keyed by Discogs ID or artist|title hash)
CREATE TABLE IF NOT EXISTS master_release_cache (
  master_id        bigint PRIMARY KEY,
  canonical_title  text,
  canonical_artist text,
  year_original    integer,
  thumb            text,
  release_count    integer,
  versions         jsonb,  -- [{release_id, year, label, format, country, notes}]
  cached_at        timestamptz DEFAULT now(),
  expires_at       timestamptz DEFAULT (now() + interval '30 days')
);

CREATE TABLE IF NOT EXISTS spotify_features_cache (
  cache_key    text PRIMARY KEY,  -- normalize(artist)|normalize(title)
  energy       numeric,
  valence      numeric,
  danceability numeric,
  acousticness numeric,
  tempo        numeric,
  loudness     numeric,
  cached_at    timestamptz DEFAULT now(),
  expires_at   timestamptz DEFAULT (now() + interval '180 days')
);

CREATE TABLE IF NOT EXISTS itunes_art_cache (
  cache_key  text PRIMARY KEY,  -- normalize(artist)|normalize(title)
  art_url    text,              -- null = "searched, not found"
  cached_at  timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '60 days')
);

-- Feature 1: wantlist tables
CREATE TABLE IF NOT EXISTS wantlist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  release_id      bigint NOT NULL,
  master_id       bigint,
  artist          text,
  title           text,
  year_pressed    integer,
  label           text,
  format          text,
  thumb           text,
  genres          text,
  styles          text,
  notes           text,
  added_at        timestamptz,
  found           boolean DEFAULT false,
  found_record_id uuid REFERENCES records(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, release_id)
);
CREATE INDEX IF NOT EXISTS wantlist_user_id_idx   ON wantlist(user_id);
CREATE INDEX IF NOT EXISTS wantlist_master_id_idx ON wantlist(master_id);

CREATE TABLE IF NOT EXISTS wantlist_import_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  status      text DEFAULT 'pending',   -- pending | running | completed | failed
  page        integer DEFAULT 1,
  total_pages integer,
  imported    integer DEFAULT 0,
  total       integer DEFAULT 0,
  error       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
