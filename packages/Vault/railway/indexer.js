/**
 * Legacy Vault indexer — listens for contract events and syncs them to Supabase.
 */

import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const RPC_URL = process.env.ALCHEMY_API_KEY
  ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : (process.env.RPC_URL || '');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BLOCK_CHUNK = Math.max(1, Number.parseInt(process.env.INDEXER_BLOCK_CHUNK_SIZE || '10', 10) || 10);
const POLL_MS = Math.max(5000, Number.parseInt(process.env.INDEXER_POLL_MS || '15000', 10) || 15000);

if (!CONTRACT_ADDRESS || !RPC_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: CONTRACT_ADDRESS, RPC_URL/ALCHEMY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CONTRACT_ABI = [
  'event VaultCreated(string indexed vaultId, address indexed owner, string cid, uint256 releaseTimestamp)',
  'event AccessGranted(string indexed vaultId, address indexed heir)',
  'event AccessRevoked(string indexed vaultId, address indexed heir)',
  'event ReleaseTimeExtended(string indexed vaultId, uint256 newTimestamp)',
  'function createVault(string,string,bytes32,bytes,uint256)',
  'function grantAccess(string,address)',
  'function grantAccessToMultiple(string,address[])',
  'function revokeAccess(string,address)',
  'function extendReleaseTime(string,uint256)',
  'function getVaultMetadata(string) view returns (address owner, string cid, uint256 releaseTimestamp, uint256 createdAt)',
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
const vaultIdByTx = new Map();

function lower(addr) {
  return String(addr).toLowerCase();
}

function ts(seconds) {
  return new Date(Number(seconds) * 1000).toISOString();
}

async function queryLogs(filter, fromBlock, toBlock) {
  const events = [];
  let start = fromBlock;
  let chunk = BLOCK_CHUNK;

  while (start <= toBlock) {
    const end = Math.min(start + chunk - 1, toBlock);
    try {
      const batch = await contract.queryFilter(filter, start, end);
      if (batch?.length) events.push(...batch);
      start = end + 1;
    } catch (err) {
      if (chunk > 1) {
        chunk = Math.max(1, Math.floor(chunk / 2));
        continue;
      }
      throw err;
    }
  }

  return events;
}

async function checkSupabase() {
  const { error } = await supabase.from('indexer_state').select('id').limit(1);
  if (!error) return;

  const msg = error.message || '';
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND')) {
    console.error(`Cannot reach Supabase: ${SUPABASE_URL}`);
    console.error('Check SUPABASE_URL in railway/.env (must match your project URL exactly).');
    process.exit(1);
  }
  if (error.code === 'PGRST205' || msg.includes('Could not find the table')) {
    console.error('Supabase table "indexer_state" not found.');
    console.error('Run sdk/packages/Vault/supabase/migrations/001_create_tables.sql in the Supabase SQL editor.');
    process.exit(1);
  }
  console.error('Supabase check failed:', error);
  process.exit(1);
}

async function ensureIndexerStateRow() {
  const { data, error } = await supabase
    .from('indexer_state')
    .select('last_block')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    console.error('Failed to read indexer_state:', error.message);
    throw error;
  }

  if (data) return;

  const currentBlock = await provider.getBlockNumber();
  const start = Math.max(0, currentBlock - 1);
  const { error: insertError } = await supabase.from('indexer_state').insert({
    id: 'main',
    last_block: start,
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error('Failed to initialize indexer_state:', insertError.message);
    throw insertError;
  }

  console.log(`Created indexer_state row (checkpoint block ${start})`);
}

async function getLastProcessedBlock() {
  const { data, error } = await supabase
    .from('indexer_state')
    .select('last_block')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    console.error('Failed to read indexer_state:', error.message);
    throw error;
  }

  if (!data || data.last_block == null) return null;
  const block = Number(data.last_block);
  if (block === 0) return null;
  return block;
}

async function setLastProcessedBlock(blockNumber) {
  const { error } = await supabase.from('indexer_state').upsert(
    { id: 'main', last_block: blockNumber, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) {
    console.error('Failed to update indexer_state:', error.message);
    throw error;
  }
}

async function upsertUser(walletAddress) {
  const { error } = await supabase.from('users').upsert(
    {
      wallet_address: lower(walletAddress),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wallet_address' }
  );
  if (error) console.error(`Failed to upsert user ${walletAddress}:`, error.message);
}

/** vaultId is indexed in all events — recover it from the transaction input. */
async function getVaultId(event) {
  const cached = vaultIdByTx.get(event.transactionHash);
  if (cached) return cached;

  const tx = await provider.getTransaction(event.transactionHash);
  if (!tx?.data) return null;

  try {
    const parsed = contract.interface.parseTransaction({ data: tx.data });
    const vaultId = parsed?.args?.[0] != null ? String(parsed.args[0]) : null;
    if (vaultId) vaultIdByTx.set(event.transactionHash, vaultId);
    return vaultId;
  } catch {
    return null;
  }
}

async function ensureVaultExists(vaultId, blockNumber, transactionHash) {
  const { data } = await supabase.from('vaults').select('vault_id').eq('vault_id', vaultId).maybeSingle();
  if (data) return;

  const [owner, cid, releaseTimestamp] = await contract.getVaultMetadata(vaultId);
  await upsertUser(owner);
  const { error } = await supabase.from('vaults').insert({
    vault_id: vaultId,
    owner_address: lower(owner),
    cid: String(cid),
    release_timestamp: ts(releaseTimestamp),
    vault_type: 'text',
    block_number: blockNumber,
    transaction_hash: transactionHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.error(`Failed to create vault ${vaultId}:`, error.message);
}

async function handleVaultCreated(event) {
  const vaultId = await getVaultId(event);
  if (!vaultId) {
    console.warn('VaultCreated: could not resolve vaultId, skipping');
    return;
  }

  const owner = event.args.owner ?? event.args[1];
  const cid = String(event.args.cid ?? event.args[2]);
  const releaseTimestamp = event.args.releaseTimestamp ?? event.args[3];

  await upsertUser(owner);

  const { data: existing } = await supabase.from('vaults').select('vault_id').eq('vault_id', vaultId).maybeSingle();
  const row = {
    owner_address: lower(owner),
    cid,
    release_timestamp: ts(releaseTimestamp),
    block_number: event.blockNumber,
    transaction_hash: event.transactionHash,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase.from('vaults').update(row).eq('vault_id', vaultId);
    if (error) console.error(`VaultCreated update failed (${vaultId}):`, error.message);
    else console.log(`VaultCreated: updated ${vaultId}`);
    return;
  }

  const { error } = await supabase.from('vaults').insert({
    vault_id: vaultId,
    ...row,
    vault_type: 'text',
    created_at: new Date().toISOString(),
  });
  if (error) console.error(`VaultCreated insert failed (${vaultId}):`, error.message);
  else console.log(`VaultCreated: indexed ${vaultId}`);
}

async function handleAccessGranted(event) {
  const vaultId = await getVaultId(event);
  const heir = event.args.heir ?? event.args[1];
  if (!vaultId || !heir) {
    console.warn('AccessGranted: missing vaultId or heir, skipping');
    return;
  }

  await ensureVaultExists(vaultId, event.blockNumber, event.transactionHash);
  await upsertUser(heir);

  const { data: existing } = await supabase
    .from('heirs')
    .select('id')
    .eq('vault_id', vaultId)
    .eq('heir_address', lower(heir))
    .maybeSingle();

  const row = {
    is_active: true,
    granted_at: new Date().toISOString(),
    revoked_at: null,
    block_number: event.blockNumber,
    transaction_hash: event.transactionHash,
  };

  if (existing) {
    await supabase.from('heirs').update(row).eq('id', existing.id);
  } else {
    await supabase.from('heirs').insert({
      vault_id: vaultId,
      heir_address: lower(heir),
      ...row,
    });
  }

  console.log(`AccessGranted: ${vaultId} -> ${lower(heir)}`);
}

async function handleAccessRevoked(event) {
  const vaultId = await getVaultId(event);
  const heir = event.args.heir ?? event.args[1];
  if (!vaultId || !heir) {
    console.warn('AccessRevoked: missing vaultId or heir, skipping');
    return;
  }

  await ensureVaultExists(vaultId, event.blockNumber, event.transactionHash);

  const { error } = await supabase
    .from('heirs')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      block_number: event.blockNumber,
      transaction_hash: event.transactionHash,
    })
    .eq('vault_id', vaultId)
    .eq('heir_address', lower(heir));

  if (error) console.error(`AccessRevoked failed (${vaultId}):`, error.message);
  else console.log(`AccessRevoked: ${vaultId} -> ${lower(heir)}`);
}

async function handleReleaseTimeExtended(event) {
  const vaultId = await getVaultId(event);
  const newTimestamp = event.args.newTimestamp ?? event.args[1];
  if (!vaultId) {
    console.warn('ReleaseTimeExtended: could not resolve vaultId, skipping');
    return;
  }

  await ensureVaultExists(vaultId, event.blockNumber, event.transactionHash);

  const { error } = await supabase
    .from('vaults')
    .update({
      release_timestamp: ts(newTimestamp),
      updated_at: new Date().toISOString(),
    })
    .eq('vault_id', vaultId);

  if (error) console.error(`ReleaseTimeExtended failed (${vaultId}):`, error.message);
  else console.log(`ReleaseTimeExtended: ${vaultId}`);
}

async function processBlockRange(fromBlock, toBlock) {
  vaultIdByTx.clear();
  let count = 0;

  const created = await queryLogs(contract.filters.VaultCreated(), fromBlock, toBlock);
  for (const event of created) { await handleVaultCreated(event); count++; }

  const granted = await queryLogs(contract.filters.AccessGranted(), fromBlock, toBlock);
  for (const event of granted) { await handleAccessGranted(event); count++; }

  const revoked = await queryLogs(contract.filters.AccessRevoked(), fromBlock, toBlock);
  for (const event of revoked) { await handleAccessRevoked(event); count++; }

  const extended = await queryLogs(contract.filters.ReleaseTimeExtended(), fromBlock, toBlock);
  for (const event of extended) { await handleReleaseTimeExtended(event); count++; }

  return count;
}

async function indexEvents() {
  const currentBlock = await provider.getBlockNumber();
  let lastBlock = await getLastProcessedBlock();

  const backfillFrom = process.env.BACKFILL_FROM_BLOCK
    ? Number.parseInt(process.env.BACKFILL_FROM_BLOCK, 10)
    : null;
  if (
    backfillFrom != null &&
    Number.isFinite(backfillFrom) &&
    (lastBlock == null || lastBlock < backfillFrom - 1)
  ) {
    lastBlock = backfillFrom - 1;
    console.log(`Backfill enabled — indexing from block ${backfillFrom}`);
  }

  if (lastBlock === null) {
    const start = Math.max(0, currentBlock - 1);
    console.log(`First run — checkpoint at block ${start}, will index from ${start + 1}`);
    await setLastProcessedBlock(start);
    return;
  }

  const fromBlock = lastBlock + 1;
  if (fromBlock > currentBlock) {
    console.log(`Up to date (block ${currentBlock})`);
    return;
  }

  let cursor = fromBlock;
  while (cursor <= currentBlock) {
    const toBlock = Math.min(cursor + BLOCK_CHUNK - 1, currentBlock);
    console.log(`Blocks ${cursor} → ${toBlock}`);
    const eventCount = await processBlockRange(cursor, toBlock);
    if (eventCount === 0) console.log('  (no contract events in this range)');
    await setLastProcessedBlock(toBlock);
    cursor = toBlock + 1;
  }

  console.log(`Done through block ${currentBlock}`);
}

async function startIndexer() {
  console.log('Legacy Vault indexer');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL.replace(/\/v2\/[^/]+$/, '/v2/***')}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  await checkSupabase();
  await ensureIndexerStateRow();

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await indexEvents();
    } catch (err) {
      console.error('Indexer error:', err);
    } finally {
      running = false;
    }
  };

  await tick();
  setInterval(tick, POLL_MS);
}

startIndexer().catch((err) => {
  console.error(err);
  process.exit(1);
});
