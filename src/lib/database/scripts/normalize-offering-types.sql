-- Normalize legacy offering types to supported enum values.
-- Any unknown/null value is converted to league.
UPDATE offerings
SET type = 'league'
WHERE COALESCE(LOWER(TRIM(type)), '') NOT IN ('league', 'tournament', 'other');
