ALTER TABLE station_settings ALTER COLUMN name SET DEFAULT 'LogronoWaters';

UPDATE station_settings
SET name = 'LogronoWaters', updated_at = now()
WHERE name = 'AquaFlow';
