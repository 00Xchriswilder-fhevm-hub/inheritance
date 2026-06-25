# Legacy Vault Indexer

Watches the FHELegacyVault contract for events and writes them to Supabase.

## What it does

1. Polls new blocks every 15s (configurable).
2. Reads four events: `VaultCreated`, `AccessGranted`, `AccessRevoked`, `ReleaseTimeExtended`.
3. Upserts `users`, `vaults`, and `heirs` in Supabase.
4. Saves progress in `indexer_state.last_block`.

`vaultId` is indexed on-chain (hashed in logs), so the indexer recovers it by decoding the transaction input. That is the only non-obvious step.

## Env vars

```env
CONTRACT_ADDRESS=0x...
ALCHEMY_API_KEY=...          # or RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
INDEXER_BLOCK_CHUNK_SIZE=10  # eth_getLogs range (Alchemy free tier ~10)
INDEXER_POLL_MS=15000
BACKFILL_FROM_BLOCK=11135520  # one-time catch-up for missed blocks
```

## Run

```bash
npm install
npm start
```

## Catch up after a missed event

Set `BACKFILL_FROM_BLOCK` to the block **before** the missed transaction, restart the indexer, then remove the variable.

Example: tx in block `11135526` → `BACKFILL_FROM_BLOCK=11135520`

## Tables

See `../supabase/migrations/001_create_tables.sql` — needs `users`, `vaults`, `heirs`, `indexer_state`.

The app also writes vault rows on create (with file metadata). The indexer is the source of truth for heir grant/revoke events and can backfill vault rows from chain data if needed.
