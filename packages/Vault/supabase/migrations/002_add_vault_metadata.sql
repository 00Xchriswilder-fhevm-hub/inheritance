-- Add additional metadata columns to vaults table if needed
-- This migration can be used to add fields later without recreating tables

-- Add content preview field (encrypted or hashed)
-- ALTER TABLE vaults ADD COLUMN IF NOT EXISTS content_preview TEXT;

-- Add tags for organization
-- ALTER TABLE vaults ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add notes field
-- ALTER TABLE vaults ADD COLUMN IF NOT EXISTS notes TEXT;

