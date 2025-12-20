-- Add free trial fields to user_profiles table
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "free_trial_started_at" timestamp;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "free_trial_ends_at" timestamp;

