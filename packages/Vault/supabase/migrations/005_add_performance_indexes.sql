-- Performance optimization indexes
-- These composite indexes will speed up common query patterns

-- Composite index for heirs query: heir_address + is_active (most common query)
CREATE INDEX IF NOT EXISTS idx_heirs_heir_address_active 
ON heirs(heir_address, is_active) 
WHERE is_active = TRUE;

-- Composite index for vaults + owner lookups
CREATE INDEX IF NOT EXISTS idx_vaults_owner_created 
ON vaults(owner_address, created_at DESC);

-- Index for the join query pattern (heirs -> vaults)
-- This helps when joining heirs with vaults
CREATE INDEX IF NOT EXISTS idx_heirs_vault_id_active 
ON heirs(vault_id, is_active) 
WHERE is_active = TRUE;

-- Analyze tables to update statistics (helps query planner)
ANALYZE vaults;
ANALYZE heirs;
ANALYZE users;

