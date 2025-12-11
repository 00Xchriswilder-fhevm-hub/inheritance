# Supabase Integration

This folder contains Supabase database service for Legacy Vault.

## Files

- `supabaseService.ts`: Database operations for users, vaults, and heirs

## Setup

1. Install dependencies:
```bash
npm install @supabase/supabase-js
```

2. Configure in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Schema

### users table
```sql
CREATE TABLE users (
    wallet_address TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### vaults table
```sql
CREATE TABLE vaults (
    vault_id TEXT PRIMARY KEY,
    owner_address TEXT REFERENCES users(wallet_address),
    cid TEXT NOT NULL,
    release_timestamp TIMESTAMP NOT NULL,
    vault_type TEXT CHECK (vault_type IN ('text', 'file')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    block_number BIGINT,
    transaction_hash TEXT
);
```

### heirs table
```sql
CREATE TABLE heirs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT REFERENCES vaults(vault_id),
    heir_address TEXT REFERENCES users(wallet_address),
    granted_at TIMESTAMP DEFAULT NOW(),
    block_number BIGINT,
    transaction_hash TEXT,
    UNIQUE(vault_id, heir_address)
);
```

### indexer_state table
```sql
CREATE TABLE indexer_state (
    id TEXT PRIMARY KEY,
    last_block BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO indexer_state (id, last_block) VALUES ('main', 0);
```

## Usage

```typescript
import { userService, vaultService, heirService } from './supabase/supabaseService';

// Create user
await userService.upsertUser(walletAddress);

// Create vault
await vaultService.createVault({
    vaultId: 'vault-123',
    ownerAddress: '0x...',
    cid: 'Qm...',
    releaseTimestamp: Date.now(),
    vaultType: 'text'
});

// Add heir
await heirService.createHeir({
    vaultId: 'vault-123',
    heirAddress: '0x...'
});
```

