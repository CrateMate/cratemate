CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS wantlist_price_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  release_id bigint NOT NULL,
  threshold_price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  enabled boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, release_id)
);
