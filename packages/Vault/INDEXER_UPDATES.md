# Railway Indexer Updates - Heir Management

## Changes Made

### 1. ✅ AccessGranted Event Handling
- **Before**: Simply inserted new heir record
- **After**: 
  - Checks if heir record already exists
  - If exists and was revoked, reactivates it (sets `is_active = true`, clears `revoked_at`)
  - If new, creates record with `is_active = true`
  - Preserves audit trail

### 2. ✅ AccessRevoked Event Handling
- **Before**: Deleted heir record completely
- **After**:
  - Updates record to set `is_active = false` and `revoked_at` timestamp
  - Preserves history for audit purposes
  - If record doesn't exist, creates revoked record for audit trail

### 3. ✅ Supabase Service Updates
- `getHeirsByVault()` now has `activeOnly` parameter (defaults to `true`)
- `removeHeir()` now marks as inactive instead of deleting
- Added `reactivateHeir()` method for reactivating previously revoked heirs

## How It Works

### When Owner Adds Heir:
1. Blockchain emits `AccessGranted` event
2. Railway indexer processes event
3. Checks if heir record exists:
   - **If exists**: Reactivates (for previously revoked heirs)
   - **If new**: Creates new active record
4. Supabase `heirs` table updated with `is_active = true`

### When Owner Revokes Heir:
1. Blockchain emits `AccessRevoked` event
2. Railway indexer processes event
3. Updates heir record:
   - Sets `is_active = false`
   - Sets `revoked_at` timestamp
   - Preserves `granted_at` for history
4. Supabase `heirs` table updated (record preserved, marked inactive)

## Database Schema

The `heirs` table includes:
- `is_active` (boolean) - Whether heir currently has access
- `granted_at` (timestamp) - When access was granted
- `revoked_at` (timestamp, nullable) - When access was revoked (if applicable)
- `block_number` and `transaction_hash` - For audit trail

## Benefits

1. **Audit Trail**: Full history of heir additions/revocations preserved
2. **Reactivation**: Previously revoked heirs can be reactivated
3. **Data Integrity**: No data loss when revoking access
4. **Query Flexibility**: Can query active heirs only or full history

## Testing

To test the indexer:
1. Deploy to Railway with environment variables set
2. Create a vault and grant heir access → Check Supabase
3. Revoke heir access → Check `is_active = false` in Supabase
4. Grant access again → Check `is_active = true` in Supabase

