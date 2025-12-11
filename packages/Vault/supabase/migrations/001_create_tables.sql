-- Legacy Vault Database Schema
-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    has_active_subscription BOOLEAN DEFAULT FALSE,
    subscription_product_id TEXT,
    subscription_expires_at TIMESTAMP,
    subscription_will_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vaults table
CREATE TABLE IF NOT EXISTS vaults (
    vault_id TEXT PRIMARY KEY,
    owner_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    cid TEXT NOT NULL,
    ipfs_gateway_url TEXT,
    release_timestamp TIMESTAMP NOT NULL,
    vault_type TEXT CHECK (vault_type IN ('text', 'file')) NOT NULL,
    content_length INTEGER,
    file_name TEXT,
    file_type TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    block_number BIGINT,
    transaction_hash TEXT
);

-- Heirs table
CREATE TABLE IF NOT EXISTS heirs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
    heir_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    block_number BIGINT,
    transaction_hash TEXT,
    UNIQUE(vault_id, heir_address)
);

-- Indexer state table
CREATE TABLE IF NOT EXISTS indexer_state (
    id TEXT PRIMARY KEY,
    last_block BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table (for tracking subscription events)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    purchase_date TIMESTAMP DEFAULT NOW(),
    expiration_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    will_renew BOOLEAN DEFAULT FALSE,
    revenue_cat_customer_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vaults_owner ON vaults(owner_address);
CREATE INDEX IF NOT EXISTS idx_vaults_release_timestamp ON vaults(release_timestamp);
CREATE INDEX IF NOT EXISTS idx_heirs_vault_id ON heirs(vault_id);
CREATE INDEX IF NOT EXISTS idx_heirs_heir_address ON heirs(heir_address);
CREATE INDEX IF NOT EXISTS idx_heirs_active ON heirs(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_address);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(has_active_subscription) WHERE has_active_subscription = TRUE;

-- Insert initial indexer state
INSERT INTO indexer_state (id, last_block) 
VALUES ('main', 0)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE heirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (wallet_address = current_setting('app.current_user', TRUE));

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (wallet_address = current_setting('app.current_user', TRUE));

-- Vaults: users can see vaults they own or are heirs to
CREATE POLICY "Users can view their own vaults" ON vaults
    FOR SELECT USING (
        owner_address = current_setting('app.current_user', TRUE)
        OR EXISTS (
            SELECT 1 FROM heirs 
            WHERE heirs.vault_id = vaults.vault_id 
            AND heirs.heir_address = current_setting('app.current_user', TRUE)
            AND heirs.is_active = TRUE
        )
    );

-- Heirs: users can see heirs for vaults they own or are heirs to
CREATE POLICY "Users can view relevant heirs" ON heirs
    FOR SELECT USING (
        vault_id IN (
            SELECT vault_id FROM vaults 
            WHERE owner_address = current_setting('app.current_user', TRUE)
        )
        OR heir_address = current_setting('app.current_user', TRUE)
    );

-- Subscriptions: users can only see their own subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (user_address = current_setting('app.current_user', TRUE));

-- Note: For service role operations (indexer), use service role key which bypasses RLS

