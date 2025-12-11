# Legacy Vault Indexer

Railway service that indexes blockchain events and syncs them to Supabase.

## Setup

1. Deploy to Railway
2. Set environment variables:
   - `CONTRACT_ADDRESS`: FHELegacyVault contract address (e.g., `0x57fa41328ecBe5f281c10E99e9740Ddf7f5A0c06`)
   - `RPC_URL`: Alchemy RPC endpoint (e.g., `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`)
   - `ALCHEMY_API_KEY`: Alchemy API key (e.g., `LpvcvaTYYt8nnbnGutlfF`)
   - `SUPABASE_URL`: Supabase project URL (e.g., `https://zwlxuwmcdoahflzfoavb.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (get from Supabase dashboard)

### Environment Variables Example

```env
CONTRACT_ADDRESS=0x57fa41328ecBe5f281c10E99e9740Ddf7f5A0c06
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/LpvcvaTYYt8nnbnGutlfF
ALCHEMY_API_KEY=LpvcvaTYYt8nnbnGutlfF
SUPABASE_URL=https://zwlxuwmcdoahflzfoavb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Note:** The indexer starts tracking from the current block when first deployed (skips historical backfill to avoid processing too many blocks on Sepolia).

## Database Schema

The indexer expects the following Supabase tables:

### users
- `wallet_address` (text, primary key)
- `email` (text, nullable)
- `name` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### vaults
- `vault_id` (text, primary key)
- `owner_address` (text, foreign key -> users.wallet_address)
- `cid` (text)
- `release_timestamp` (timestamp)
- `vault_type` (text: 'text' | 'file')
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `block_number` (bigint)
- `transaction_hash` (text)

### heirs
- `id` (uuid, primary key)
- `vault_id` (text, foreign key -> vaults.vault_id)
- `heir_address` (text, foreign key -> users.wallet_address)
- `granted_at` (timestamp)
- `block_number` (bigint)
- `transaction_hash` (text)

### indexer_state
- `id` (text, primary key)
- `last_block` (bigint)
- `updated_at` (timestamp)

## Running

```bash
npm install
npm start
```

The indexer runs continuously, processing new blocks every 30 seconds.

## Events Tracked

The indexer scans and logs the following events from the FHELegacyVault contract:

### 1. **VaultCreated**
- **Event**: `VaultCreated(string indexed vaultId, address indexed owner, string cid, uint256 releaseTimestamp)`
- **Action**: Creates a new vault record in Supabase
- **Data Logged**:
  - Vault ID
  - Owner address (creates/updates user record)
  - IPFS CID
  - Release timestamp
  - Block number and transaction hash

### 2. **AccessGranted**
- **Event**: `AccessGranted(string indexed vaultId, address indexed heir)`
- **Action**: Grants access to a heir for a vault
- **Data Logged**:
  - Vault ID
  - Heir address (creates/updates user record)
  - Grant timestamp
  - Block number and transaction hash
  - Marks heir as active

### 3. **AccessRevoked**
- **Event**: `AccessRevoked(string indexed vaultId, address indexed heir)`
- **Action**: Revokes access from a heir (marks as inactive, preserves history)
- **Data Logged**:
  - Vault ID
  - Heir address
  - Revocation timestamp
  - Block number and transaction hash
  - Marks heir as inactive (doesn't delete for audit trail)

### 4. **ReleaseTimeExtended**
- **Event**: `ReleaseTimeExtended(string indexed vaultId, uint256 newTimestamp)`
- **Action**: Updates the release timestamp for a vault
- **Data Logged**:
  - Vault ID
  - New release timestamp
  - Block number and transaction hash
  - Updates vault record in Supabase

## Event Processing Flow

1. **Vault Creation**: When a vault is created, the indexer:
   - Creates/updates the owner in the `users` table
   - Creates a new record in the `vaults` table

2. **Heir Management**: When access is granted or revoked:
   - Creates/updates the heir in the `users` table
   - Creates or updates the `heirs` table record
   - Maintains an audit trail (doesn't delete revoked heirs)

3. **Release Time Extension**: When release time is extended:
   - Updates the `release_timestamp` in the `vaults` table
   - Preserves the original creation timestamp

