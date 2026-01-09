-- Migration: Drop old personal_records table
-- Purpose: Consolidate to personal_records_history table
-- Warning: This deletes the old table and its data. Ensure data is backed up if needed (user confirmed it's empty/unused).

DROP TABLE IF EXISTS "public"."personal_records";
