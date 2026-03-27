-- Add Stripe Pro subscription fields to user_profiles

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_pro              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
