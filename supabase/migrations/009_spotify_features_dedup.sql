-- Fix duplicate rows in spotify_features caused by upserts that lacked onConflict: "record_id".
-- Without that clause, every call inserted a new row instead of updating.
-- Strategy: keep the row with real features (energy IS NOT NULL) if one exists,
-- otherwise keep the most recent row. Then enforce uniqueness.

-- Step 1: Delete duplicate rows, keeping the best one per record_id.
-- "Best" = has energy data; tie-break by highest id (most recent insert).
DELETE FROM spotify_features
WHERE id NOT IN (
  SELECT DISTINCT ON (record_id)
    id
  FROM spotify_features
  ORDER BY
    record_id,
    (energy IS NOT NULL) DESC,  -- prefer rows with real features
    id DESC                      -- tie-break: most recent
);

-- Step 2: Add a unique constraint so this can never happen again.
ALTER TABLE spotify_features
  ADD CONSTRAINT spotify_features_record_id_unique UNIQUE (record_id);
