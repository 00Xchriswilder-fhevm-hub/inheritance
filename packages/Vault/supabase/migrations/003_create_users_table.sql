-- Create users table if it doesn't exist
-- This is a fix for missing users table

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

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(has_active_subscription) WHERE has_active_subscription = TRUE;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
-- Note: Service role key bypasses RLS, so indexer can still insert
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (wallet_address = current_setting('app.current_user', TRUE));

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (wallet_address = current_setting('app.current_user', TRUE));

