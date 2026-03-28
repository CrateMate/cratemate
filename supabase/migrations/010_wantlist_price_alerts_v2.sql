-- Price alert settings per master/album (grouped level)
CREATE TABLE IF NOT EXISTS wantlist_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  master_id bigint NOT NULL,
  target_price_usd numeric,
  enabled boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, master_id)
);

-- Daily price history per release for price drop detection
CREATE TABLE IF NOT EXISTS wantlist_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id bigint NOT NULL,
  price_usd numeric NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(release_id, recorded_at)
);

-- Index for efficient rolling average queries
CREATE INDEX IF NOT EXISTS idx_wantlist_price_history_release_date
  ON wantlist_price_history (release_id, recorded_at DESC);
