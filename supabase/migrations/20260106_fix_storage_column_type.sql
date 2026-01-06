-- storage_used_mb was INTEGER, but we need NUMERIC to store fractional MB values
ALTER TABLE student_quotas
ALTER COLUMN storage_used_mb TYPE NUMERIC(10, 2) USING storage_used_mb::NUMERIC(10, 2);

-- Also fix storage_total_mb if it's integer
ALTER TABLE student_quotas
ALTER COLUMN storage_total_mb TYPE NUMERIC(10, 2) USING storage_total_mb::NUMERIC(10, 2);
