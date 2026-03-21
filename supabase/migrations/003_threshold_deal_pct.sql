ALTER TABLE wantlist_price_thresholds
  DROP COLUMN IF EXISTS threshold_price,
  ADD COLUMN IF NOT EXISTS threshold_deal_pct integer NOT NULL DEFAULT 20;
