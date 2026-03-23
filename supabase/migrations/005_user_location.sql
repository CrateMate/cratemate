-- Add location fields to user_profiles for weather-based recommendations

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS city_name  text,
  ADD COLUMN IF NOT EXISTS latitude   numeric,
  ADD COLUMN IF NOT EXISTS longitude  numeric;
