-- Fix RLS policies to allow frontend access
-- The frontend uses anon key, so we need policies that work without session variables

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own vaults" ON vaults;
DROP POLICY IF EXISTS "Users can view relevant heirs" ON heirs;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;

-- New policies that allow public read (RLS still enabled, but policies allow access)
-- Note: For write operations, you may want to add authentication checks later

-- Users: Allow public read (anyone can see user records - wallet addresses are public anyway)
CREATE POLICY "Allow public read on users" ON users
    FOR SELECT USING (true);

-- Users: Allow public insert/update (for indexer and frontend)
CREATE POLICY "Allow public insert on users" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on users" ON users
    FOR UPDATE USING (true);

-- Vaults: Allow public read (vault metadata is public on blockchain anyway)
CREATE POLICY "Allow public read on vaults" ON vaults
    FOR SELECT USING (true);

-- Vaults: Allow public insert/update (for indexer)
CREATE POLICY "Allow public insert on vaults" ON vaults
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on vaults" ON vaults
    FOR UPDATE USING (true);

-- Heirs: Allow public read
CREATE POLICY "Allow public read on heirs" ON heirs
    FOR SELECT USING (true);

-- Heirs: Allow public insert/update (for indexer)
CREATE POLICY "Allow public insert on heirs" ON heirs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on heirs" ON heirs
    FOR UPDATE USING (true);

-- Subscriptions: Allow public read
CREATE POLICY "Allow public read on subscriptions" ON subscriptions
    FOR SELECT USING (true);

-- Subscriptions: Allow public insert (for logging)
CREATE POLICY "Allow public insert on subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (true);

-- Note: Service role key bypasses RLS, so indexer will work regardless
-- These policies allow the frontend (using anon key) to read/write data

