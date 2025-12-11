# Supabase Migrations

Run these SQL files in order in your Supabase SQL Editor.

## Migration Order

1. `001_create_tables.sql` - Creates all required tables
2. `002_add_vault_metadata.sql` - Optional metadata fields (currently empty, for future use)

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run `001_create_tables.sql` first
4. Verify tables are created in Table Editor
5. (Optional) Run `002_add_vault_metadata.sql` if you need additional fields

## Tables Created

- `users` - User wallet addresses and subscription status
- `vaults` - Vault records with IPFS CIDs and metadata
- `heirs` - Heir access records
- `subscriptions` - Subscription purchase history
- `indexer_state` - Railway indexer tracking

## Row Level Security (RLS)

RLS policies are created to ensure users can only access their own data. For service operations (like the Railway indexer), use the service role key which bypasses RLS.

