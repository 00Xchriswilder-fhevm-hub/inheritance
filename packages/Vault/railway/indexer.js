/**
 * Railway Indexer Service (Compiled JavaScript)
 * Syncs blockchain events to Supabase database
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Configuration from environment variables
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PINATA_JWT = process.env.PINATA_JWT || '';

// Build RPC URL from Alchemy API key if provided, otherwise use RPC_URL env var
const RPC_URL = ALCHEMY_API_KEY 
    ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : (process.env.RPC_URL || '');

if (!CONTRACT_ADDRESS || !RPC_URL || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required environment variables:');
    console.error(`  CONTRACT_ADDRESS: ${CONTRACT_ADDRESS ? '✓' : '✗'}`);
    console.error(`  RPC_URL/ALCHEMY_API_KEY: ${RPC_URL ? '✓' : '✗'}`);
    console.error(`  SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
    console.error(`  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_KEY ? '✓' : '✗'}`);
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Contract ABI (minimal for events + getVaultMetadata function)
const CONTRACT_ABI = [
    "event VaultCreated(string indexed vaultId, address indexed owner, string cid, uint256 releaseTimestamp)",
    "event AccessGranted(string indexed vaultId, address indexed heir)",
    "event AccessRevoked(string indexed vaultId, address indexed heir)",
    "event ReleaseTimeExtended(string indexed vaultId, uint256 newTimestamp)",
    "function getVaultMetadata(string calldata _vaultId) external view returns (address owner, string memory cid, uint256 releaseTimestamp, uint256 createdAt)",
    "function vaultExists(string calldata _vaultId) external view returns (bool)",
    "function authorizedHeirs(string calldata _vaultId, address _heir) external view returns (bool)",
    "function getUserVaults(address _user) external view returns (string[] memory)",
    "function grantAccess(string calldata _vaultId, address _heir) external",
    "function grantAccessToMultiple(string calldata _vaultId, address[] calldata _heirs) external",
    "function revokeAccess(string calldata _vaultId, address _heir) external",
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

/**
 * Process VaultCreated event
 */
async function processVaultCreated(
    vaultId,
    owner,
    cid,
    releaseTimestamp,
    blockNumber,
    transactionHash
) {
    try {
        // Extract strings from event arguments
        const vaultIdStr = extractStringArg(vaultId);
        const ownerStr = extractStringArg(owner);
        const cidStr = extractStringArg(cid);
        
        if (!vaultIdStr || !ownerStr || !cidStr) {
            console.error(`⚠️  [VaultCreated] Cannot extract vaultId, owner, or cid from event arguments`);
            return;
        }

        // Upsert user (owner)
        const { error: userError } = await supabase
            .from('users')
            .upsert({
                wallet_address: ownerStr.toLowerCase(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address'
            });

        if (userError) {
            console.error(`❌ [VaultCreated] Error upserting user:`, userError);
        }

        // Determine vault_type from IPFS metadata
        // Default to 'text' if we can't determine it
        let vaultType = 'text';
        let fileName = null;
        let fileType = null;
        let fileSize = null;

        try {
            // Try to fetch IPFS metadata from Pinata
            const pinataJWT = PINATA_JWT || process.env.PINATA_JWT || process.env.VITE_PINATA_JWT || '';
            if (pinataJWT && cidStr) {
                const pinataUrl = `https://api.pinata.cloud/data/pinList?hashContains=${cidStr}`;
                const response = await fetch(pinataUrl, {
                    headers: {
                        'Authorization': `Bearer ${pinataJWT}`
                    }
                });

                if (response.ok) {
                    const pinataData = await response.json();
                    if (pinataData.rows && pinataData.rows.length > 0) {
                        // Find exact match by CID
                        const pin = pinataData.rows.find((row) => row.ipfs_pin_hash === cidStr);
                        if (pin) {
                            if (pin.metadata && pin.metadata.keyvalues) {
                                if (pin.metadata.keyvalues.type === 'file') {
                                    vaultType = 'file';
                                }
                                if (pin.metadata.keyvalues.fileName) {
                                    fileName = pin.metadata.keyvalues.fileName;
                                }
                                if (pin.metadata.keyvalues.mimeType) {
                                    fileType = pin.metadata.keyvalues.mimeType;
                                }
                            }
                            if (pin.size) {
                                fileSize = pin.size;
                            }
                        }
                    }
                }
            }
        } catch (ipfsError) {
            console.warn(`⚠️  [VaultCreated] Could not fetch IPFS metadata for vault ${vaultIdStr}, defaulting to 'text':`, ipfsError.message);
        }

        // Check if vault already exists
        const { data: existingVault } = await supabase
            .from('vaults')
            .select('vault_id')
            .eq('vault_id', vaultIdStr)
            .single();

        if (existingVault) {
            // Vault already exists - update it with latest blockchain data
            console.log(`🔄 [VaultCreated] Vault ${vaultIdStr} already exists, updating with latest data...`);
            const { error: updateError } = await supabase
                .from('vaults')
                .update({
                    owner_address: ownerStr.toLowerCase(),
                    cid: cidStr,
                    release_timestamp: new Date(Number(releaseTimestamp) * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                    block_number: blockNumber,
                    transaction_hash: transactionHash,
                    vault_type: vaultType,
                    file_name: fileName,
                    file_type: fileType,
                    content_length: fileSize,
                })
                .eq('vault_id', vaultIdStr);

            if (updateError) {
                console.error(`❌ [VaultCreated] Error updating existing vault:`, updateError);
                throw updateError;
            }
            console.log(`✅ [VaultCreated] Updated existing vault: ${vaultIdStr} for owner: ${ownerStr}`);
        } else {
            // Create new vault record
            // Note: Database uses 'content_length' not 'file_size'
            const { error: vaultError } = await supabase
                .from('vaults')
                .insert({
                    vault_id: vaultIdStr,
                    owner_address: ownerStr.toLowerCase(),
                    cid: cidStr,
                    release_timestamp: new Date(Number(releaseTimestamp) * 1000).toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    block_number: blockNumber,
                    transaction_hash: transactionHash,
                    vault_type: vaultType, // Required field - NOT NULL constraint
                    file_name: fileName,
                    file_type: fileType,
                    content_length: fileSize, // Use content_length instead of file_size
                });

            if (vaultError) {
                // If insert fails due to duplicate, try update instead
                if (vaultError.code === '23505') {
                    console.log(`🔄 [VaultCreated] Vault ${vaultIdStr} already exists (race condition), updating instead...`);
                    const { error: updateError } = await supabase
                        .from('vaults')
                        .update({
                            owner_address: ownerStr.toLowerCase(),
                            cid: cidStr,
                            release_timestamp: new Date(Number(releaseTimestamp) * 1000).toISOString(),
                            updated_at: new Date().toISOString(),
                            block_number: blockNumber,
                            transaction_hash: transactionHash,
                            vault_type: vaultType,
                            file_name: fileName,
                            file_type: fileType,
                            content_length: fileSize,
                        })
                        .eq('vault_id', vaultIdStr);

                    if (updateError) {
                        console.error(`❌ [VaultCreated] Error updating vault after duplicate:`, updateError);
                        throw updateError;
                    }
                    console.log(`✅ [VaultCreated] Updated vault after duplicate: ${vaultIdStr} for owner: ${ownerStr}`);
                } else {
                    console.error(`❌ [VaultCreated] Error creating vault:`, vaultError);
                    throw vaultError;
                }
            } else {
                console.log(`✅ [VaultCreated] Indexed vault: ${vaultIdStr} for owner: ${ownerStr}`);
            }
        }

        // Sync heirs for this vault
        await syncVaultHeirs(vaultIdStr, blockNumber);
    } catch (error) {
        console.error(`❌ [VaultCreated] Error processing vault:`, error);
    }
}

/**
 * Process AccessGranted event
 */
async function processAccessGranted(
    vaultId,
    heir,
    blockNumber,
    transactionHash
) {
    try {
        // Extract strings from event arguments
        const vaultIdStr = extractStringArg(vaultId);
        const heirStr = extractStringArg(heir);
        
        if (!vaultIdStr || !heirStr) {
            console.error(`⚠️  [AccessGranted] Cannot extract vaultId or heir from event arguments`);
            console.error(`   vaultId type: ${typeof vaultId}, heir type: ${typeof heir}`);
            return;
        }

        // Ensure vault exists in database first
        await ensureVaultExists(vaultIdStr, blockNumber, transactionHash);

        // Upsert user (heir)
        const { error: userError } = await supabase
            .from('users')
            .upsert({
                wallet_address: heirStr.toLowerCase(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address'
            });

        if (userError) {
            console.error(`❌ [AccessGranted] Error upserting user:`, userError);
        }

        // Check if heir record already exists
        const { data: existingHeir } = await supabase
            .from('heirs')
            .select('id, is_active')
            .eq('vault_id', vaultIdStr)
            .eq('heir_address', heirStr.toLowerCase())
            .single();

        if (existingHeir) {
            // If record exists, reactivate it (in case it was previously revoked)
            await supabase
                .from('heirs')
                .update({
                    is_active: true,
                    granted_at: new Date().toISOString(),
                    revoked_at: null,
                    block_number: blockNumber,
                    transaction_hash: transactionHash,
                })
                .eq('id', existingHeir.id);
            
            console.log(`🔄 [AccessGranted] Reactivated heir access: vault ${vaultIdStr} -> heir ${heirStr}`);
        } else {
            // Create new heir record
            const { error: insertError } = await supabase
                .from('heirs')
                .insert({
                    vault_id: vaultIdStr,
                    heir_address: heirStr.toLowerCase(),
                    granted_at: new Date().toISOString(),
                    is_active: true,
                    revoked_at: null,
                    block_number: blockNumber,
                    transaction_hash: transactionHash,
                });
            
            if (insertError) {
                console.error(`❌ [AccessGranted] Error inserting heir record:`, insertError);
            } else {
                console.log(`➕ [AccessGranted] Indexed new access grant: vault ${vaultIdStr} -> heir ${heirStr}`);
            }
        }
    } catch (error) {
        console.error(`❌ [AccessGranted] Error processing vault:`, error);
    }
}

/**
 * Process AccessRevoked event
 */
async function processAccessRevoked(
    vaultId,
    heir,
    blockNumber,
    transactionHash
) {
    try {
        // Extract strings from event arguments
        const vaultIdStr = extractStringArg(vaultId);
        const heirStr = extractStringArg(heir);
        
        if (!vaultIdStr || !heirStr) {
            console.error(`⚠️  [AccessRevoked] Cannot extract vaultId or heir from event arguments`);
            console.error(`   vaultId type: ${typeof vaultId}, heir type: ${typeof heir}`);
            return;
        }

        // Ensure vault exists in database first
        await ensureVaultExists(vaultIdStr, blockNumber, transactionHash);

        // Update heir record to mark as revoked instead of deleting
        // This preserves history while marking as inactive
        const { error: updateError } = await supabase
            .from('heirs')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString(),
                block_number: blockNumber,
                transaction_hash: transactionHash,
            })
            .eq('vault_id', vaultIdStr)
            .eq('heir_address', heirStr.toLowerCase());

        // If update fails (record doesn't exist), try to insert as revoked
        if (updateError) {
            console.warn(`⚠️  [AccessRevoked] Heir record not found for update, creating revoked record: ${updateError.message}`);
            // Insert as revoked record for audit trail
            const { error: insertError } = await supabase
                .from('heirs')
                .insert({
                    vault_id: vaultIdStr,
                    heir_address: heirStr.toLowerCase(),
                    is_active: false,
                    revoked_at: new Date().toISOString(),
                    granted_at: new Date().toISOString(), // Set same as revoked for audit
                    block_number: blockNumber,
                    transaction_hash: transactionHash,
                });
            
            if (insertError) {
                console.error(`❌ [AccessRevoked] Error inserting revoked heir record:`, insertError);
            }
        }

        console.log(`➖ [AccessRevoked] Indexed access revocation: vault ${vaultIdStr} -> heir ${heirStr}`);
    } catch (error) {
        console.error(`❌ [AccessRevoked] Error processing vault:`, error);
    }
}

/**
 * Fetch and sync all authorized heirs for a vault by scanning historical events
 */
async function syncVaultHeirs(vaultId, vaultCreatedBlock) {
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(vaultCreatedBlock || 0, 0);
        const toBlock = currentBlock;

        // Get all AccessGranted events for this vault
        const accessGrantedFilter = contract.filters.AccessGranted(String(vaultId));
        const grantedEvents = await contract.queryFilter(accessGrantedFilter, fromBlock, toBlock);

        // Get all AccessRevoked events for this vault
        const accessRevokedFilter = contract.filters.AccessRevoked(String(vaultId));
        const revokedEvents = await contract.queryFilter(accessRevokedFilter, fromBlock, toBlock);

        // Build a map of heir addresses and their status
        const heirStatus = new Map();

        // Process all granted events (most recent wins)
        for (const event of grantedEvents) {
            if (event.args) {
                const heir = String(event.args[1]).toLowerCase();
                heirStatus.set(heir, {
                    isActive: true,
                    grantedAt: new Date(event.args[0] ? Number(event.blockNumber) * 1000 : Date.now()).toISOString(),
                    revokedAt: null,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                });
            }
        }

        // Process all revoked events (most recent wins)
        for (const event of revokedEvents) {
            if (event.args) {
                const heir = String(event.args[1]).toLowerCase();
                const existing = heirStatus.get(heir);
                if (existing) {
                    existing.isActive = false;
                    existing.revokedAt = new Date(Number(event.blockNumber) * 1000).toISOString();
                    existing.blockNumber = event.blockNumber;
                    existing.transactionHash = event.transactionHash;
                } else {
                    // Revoked without prior grant (edge case)
                    heirStatus.set(heir, {
                        isActive: false,
                        grantedAt: new Date(Number(event.blockNumber) * 1000).toISOString(),
                        revokedAt: new Date(Number(event.blockNumber) * 1000).toISOString(),
                        blockNumber: event.blockNumber,
                        transactionHash: event.transactionHash,
                    });
                }
            }
        }

        // Sync all heirs to database
        for (const [heirAddress, status] of heirStatus.entries()) {
            // Upsert user (heir) - heirs are also users, so they should be in users table
            const { error: userError } = await supabase
                .from('users')
                .upsert({
                    wallet_address: heirAddress,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'wallet_address'
                });

            if (userError) {
                console.error(`❌ [HeirSync] Error upserting user ${heirAddress}:`, userError);
            }

            // Check if heir record exists
            const { data: existingHeir, error: selectError } = await supabase
                .from('heirs')
                .select('id')
                .eq('vault_id', vaultId)
                .eq('heir_address', heirAddress)
                .single();

            if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error(`❌ [HeirSync] Error checking existing heir:`, selectError);
            }

            if (existingHeir) {
                // Update existing record
                const { error: updateError } = await supabase
                    .from('heirs')
                    .update({
                        is_active: status.isActive,
                        granted_at: status.grantedAt,
                        revoked_at: status.revokedAt,
                        block_number: status.blockNumber,
                        transaction_hash: status.transactionHash,
                    })
                    .eq('id', existingHeir.id);

                if (updateError) {
                    console.error(`❌ [HeirSync] Error updating heir ${heirAddress} for vault ${vaultId}:`, updateError);
                } else {
                    console.log(`🔄 [HeirSync] Updated heir ${heirAddress} for vault ${vaultId} (active: ${status.isActive})`);
                }
            } else {
                // Create new record
                const { error: insertError } = await supabase
                    .from('heirs')
                    .insert({
                        vault_id: vaultId,
                        heir_address: heirAddress,
                        is_active: status.isActive,
                        granted_at: status.grantedAt,
                        revoked_at: status.revokedAt,
                        block_number: status.blockNumber,
                        transaction_hash: status.transactionHash,
                    });

                if (insertError) {
                    console.error(`❌ [HeirSync] Error inserting heir ${heirAddress} for vault ${vaultId}:`, insertError);
                } else {
                    console.log(`➕ [HeirSync] Created heir ${heirAddress} for vault ${vaultId} (active: ${status.isActive})`);
                }
            }
        }

        console.log(`👥 [HeirSync] Synced ${heirStatus.size} heirs for vault ${vaultId}`);
    } catch (error) {
        console.error(`❌ [HeirSync] Error syncing heirs for vault ${vaultId}:`, error);
    }
}

/**
 * Helper function to extract string from event argument (handles indexed params in ethers v6)
 * In ethers v6, indexed string parameters are stored as topic hashes, but when decoded,
 * event.args should contain the actual string values. However, sometimes they may be
 * returned as objects with hash properties, so we need to handle both cases.
 * 
 * For vault IDs like "xfzdqmq", we expect a simple string.
 */
function extractStringArg(arg) {
    // If it's already a string, return it (most common case)
    if (typeof arg === 'string') {
        return arg;
    }
    
    // If it's a number or bigint, convert to string
    if (typeof arg === 'number' || typeof arg === 'bigint') {
        return String(arg);
    }
    
    // If it's an object (indexed parameter object in ethers v6)
    if (arg && typeof arg === 'object') {
        // For indexed string params, ethers v6 may return an object with hash property
        // We can't recover the original string from the hash alone, but if the event
        // was properly decoded, the args array should contain the actual decoded values.
        // However, if we're getting an object, try to extract any string-like properties
        
        // Check if it's an ethers.js Address or similar type with toString
        if (typeof arg.toString === 'function') {
            const str = arg.toString();
            // Only use toString if it returns something meaningful (not "[object Object]")
            if (str && str !== '[object Object]' && str.length > 0) {
                return str;
            }
        }
        
        // Try common properties
        if (arg.value !== undefined && typeof arg.value === 'string') {
            return arg.value;
        }
        if (arg._value !== undefined && typeof arg._value === 'string') {
            return arg._value;
        }
        
        // Log the object structure for debugging
        console.warn('⚠️  Could not extract string from event argument. Object structure:', {
            keys: Object.keys(arg),
            type: typeof arg,
            constructor: arg.constructor?.name,
            sample: JSON.stringify(arg).substring(0, 100)
        });
        
        // Return empty string to avoid "[object Object]" in logs/DB
        return '';
    }
    
    // Fallback: convert to string
    const result = String(arg);
    if (result === '[object Object]') {
        console.warn('⚠️  Event argument converted to "[object Object]":', arg);
        return '';
    }
    return result;
}

/**
 * Ensure vault exists in database, create it if missing and sync all heirs
 */
async function ensureVaultExists(vaultId, blockNumber, transactionHash) {
    try {
        // Extract string from vaultId (handles indexed params)
        const vaultIdStr = extractStringArg(vaultId);
        
        // Check if vault exists in database
        const { data: existingVault } = await supabase
            .from('vaults')
            .select('vault_id, block_number')
            .eq('vault_id', vaultIdStr)
            .single();

        if (existingVault) {
            return; // Vault already exists
        }

        // Vault doesn't exist, fetch from contract
        console.log(`🔍 Vault ${vaultIdStr} not found in DB, fetching from contract...`);
        
        try {
            const metadata = await contract.getVaultMetadata(vaultIdStr);
            const [owner, cid, releaseTimestamp, createdAt] = metadata;

            // Upsert owner
            await supabase
                .from('users')
                .upsert({
                    wallet_address: owner.toLowerCase(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'wallet_address'
                });

            // Find the VaultCreated event to get the actual creation block
            let creationBlock = blockNumber;
            try {
                const vaultCreatedFilter = contract.filters.VaultCreated(String(vaultId));
                const createdEvents = await contract.queryFilter(vaultCreatedFilter, 0, 'latest');
                if (createdEvents.length > 0) {
                    creationBlock = createdEvents[0].blockNumber;
                }
            } catch (e) {
                console.warn(`⚠️  Could not find VaultCreated event for ${vaultIdStr}, using provided block`);
            }

            // Determine vault_type from IPFS metadata
            // Default to 'text' if we can't determine it
            let vaultType = 'text';
            let fileName = null;
            let fileType = null;
            let fileSize = null;

            try {
                // Try to fetch IPFS metadata from Pinata
                const pinataJWT = PINATA_JWT || process.env.PINATA_JWT || process.env.VITE_PINATA_JWT || '';
                if (pinataJWT && String(cid)) {
                    const pinataUrl = `https://api.pinata.cloud/data/pinList?hashContains=${String(cid)}`;
                    const response = await fetch(pinataUrl, {
                        headers: {
                            'Authorization': `Bearer ${pinataJWT}`
                        }
                    });

                    if (response.ok) {
                        const pinataData = await response.json();
                        if (pinataData.rows && pinataData.rows.length > 0) {
                            const pin = pinataData.rows[0];
                            if (pin.metadata && pin.metadata.keyvalues) {
                                if (pin.metadata.keyvalues.type === 'file') {
                                    vaultType = 'file';
                                }
                                if (pin.metadata.keyvalues.fileName) {
                                    fileName = pin.metadata.keyvalues.fileName;
                                }
                                if (pin.metadata.keyvalues.mimeType) {
                                    fileType = pin.metadata.keyvalues.mimeType;
                                }
                            }
                            if (pin.size) {
                                fileSize = pin.size;
                            }
                        }
                    }
                }
            } catch (ipfsError) {
                console.warn(`⚠️  Could not fetch IPFS metadata for vault ${vaultIdStr}, defaulting to 'text':`, ipfsError.message);
            }

            // Create vault record
            // Note: Database uses 'content_length' not 'file_size'
            const { error: vaultError, data: vaultData } = await supabase
                .from('vaults')
                .insert({
                    vault_id: vaultIdStr,
                    owner_address: String(owner).toLowerCase(),
                    cid: String(cid),
                    release_timestamp: new Date(Number(releaseTimestamp) * 1000).toISOString(),
                    created_at: new Date(Number(createdAt) * 1000).toISOString(),
                    block_number: creationBlock,
                    transaction_hash: transactionHash,
                    vault_type: vaultType, // Required field - NOT NULL constraint
                    file_name: fileName,
                    file_type: fileType,
                    content_length: fileSize, // Use content_length instead of file_size
                })
                .select();

            if (vaultError) {
                console.error(`❌ [VaultCreated] Error creating vault in DB:`, vaultError);
                console.error(`   Vault ID: ${vaultIdStr}, Owner: ${String(owner).toLowerCase()}`);
                throw vaultError;
            }

            console.log(`✅ [VaultCreated] Created missing vault ${vaultIdStr} from contract data`);

            // Now sync all authorized heirs for this vault
            await syncVaultHeirs(vaultIdStr, creationBlock);
        } catch (contractError) {
            // If vault doesn't exist in contract, that's okay - just log and continue
            if (contractError.message && contractError.message.includes('Vault does not exist')) {
                console.warn(`⚠️  Vault ${vaultIdStr} does not exist in contract (may have been deleted or invalid event)`);
            } else {
                console.error(`⚠️  Failed to fetch vault ${vaultIdStr} from contract:`, contractError.message);
            }
            // Don't throw - allow the event processing to continue
        }
    } catch (error) {
        console.error(`❌ Error ensuring vault exists:`, error);
    }
}

/**
 * Process ReleaseTimeExtended event
 */
async function processReleaseTimeExtended(
    vaultId,
    newTimestamp,
    blockNumber,
    transactionHash
) {
    try {
        // Extract string from event argument
        const vaultIdStr = extractStringArg(vaultId);
        if (!vaultIdStr || vaultIdStr === '') {
            console.error(`⚠️  [ReleaseTimeExtended] Cannot extract vaultId from event argument:`, vaultId);
            return;
        }

        // Ensure vault exists in database first
        await ensureVaultExists(vaultIdStr, blockNumber, transactionHash);

        // Update vault release timestamp
        const { error } = await supabase
            .from('vaults')
            .update({
                release_timestamp: new Date(Number(newTimestamp) * 1000).toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('vault_id', vaultIdStr);

        if (error) {
            console.error(`❌ Error updating release time for vault ${vaultIdStr}:`, error);
        } else {
            console.log(`⏰ [ReleaseTimeExtended] Indexed release time extension: vault ${vaultIdStr}`);
        }
    } catch (error) {
        console.error(`❌ [ReleaseTimeExtended] Error processing vault:`, error);
    }
}

/**
 * Get last processed block number from database
 * If no record exists, start from current block (skip historical backfill)
 */
async function getLastProcessedBlock() {
    try {
        const { data } = await supabase
            .from('indexer_state')
            .select('last_block')
            .eq('id', 'main')
            .single();

        // If no record exists, return null to start from current block
        if (!data || !data.last_block) {
            return null;
        }

        return data.last_block;
    } catch (error) {
        // If table doesn't exist or error, start from current block
        return null;
    }
}

/**
 * Update last processed block number
 */
async function updateLastProcessedBlock(blockNumber) {
    try {
        await supabase
            .from('indexer_state')
            .upsert({
                id: 'main',
                last_block: blockNumber,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'id'
            });
    } catch (error) {
        console.error('Error updating last processed block:', error);
    }
}

/**
 * Main indexing function
 */
async function indexEvents() {
    try {
        const lastBlock = await getLastProcessedBlock();
        const currentBlock = await provider.getBlockNumber();
        
        // If no last block exists, start from current block (skip historical backfill)
        if (lastBlock === null) {
            console.log(`🚀 No previous index state found. Starting from current block ${currentBlock} (skipping historical backfill)`);
            await updateLastProcessedBlock(currentBlock);
            return;
        }
        
        // Process in chunks to avoid timeout
        const chunkSize = 1000;
        let fromBlock = lastBlock + 1;
        
        // If we're already at the latest block, nothing to process
        if (fromBlock > currentBlock) {
            console.log(`✨ Already up to date. Current block: ${currentBlock}`);
            return;
        }
        
        while (fromBlock <= currentBlock) {
            const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
            
            console.log(`📦 Processing blocks ${fromBlock} to ${toBlock}`);
            
            // Get VaultCreated events
            const vaultCreatedFilter = contract.filters.VaultCreated();
            const vaultCreatedEvents = await contract.queryFilter(
                vaultCreatedFilter,
                fromBlock,
                toBlock
            );
            
            for (const event of vaultCreatedEvents) {
                if (event.args) {
                    // In ethers v6, event.args can be an array or an object with named properties
                    // Try named properties first, then fall back to array indices
                    // For vault IDs like "xfzdqmq", we expect simple strings
                    let vaultId = event.args.vaultId || event.args[0];
                    let owner = event.args.owner || event.args[1];
                    let cid = event.args.cid || event.args[2];
                    let releaseTimestamp = event.args.releaseTimestamp || event.args[3];
                    
                    // Extract owner and cid first (these should always be strings)
                    owner = extractStringArg(owner);
                    cid = extractStringArg(cid);
                    releaseTimestamp = Number(releaseTimestamp);
                    
                    // Handle vaultId - if it's an Indexed object, we need to recover it
                    if (vaultId && typeof vaultId === 'object' && vaultId._isIndexed === true) {
                        // Indexed string parameter - can't recover from hash alone
                        // Use owner + cid to find the vault ID from the contract
                        console.log(`🔍 [VaultCreated] vaultId is indexed, recovering from contract using owner: ${owner}, cid: ${cid}`);
                        try {
                            const userVaults = await contract.getUserVaults(owner);
                            // Find vault ID that matches this CID by checking metadata
                            let foundVaultId = null;
                            for (const vid of userVaults) {
                                try {
                                    const metadata = await contract.getVaultMetadata(vid);
                                    if (metadata && metadata[1] === cid) { // metadata[1] is CID
                                        foundVaultId = vid;
                                        break;
                                    }
                                } catch (e) {
                                    // Continue searching
                                }
                            }
                            
                            if (foundVaultId) {
                                vaultId = foundVaultId;
                                console.log(`✅ [VaultCreated] Recovered vaultId: ${vaultId}`);
                            } else {
                                console.error(`❌ [VaultCreated] Could not recover vaultId for owner ${owner}, cid ${cid}`);
                                continue; // Skip this event
                            }
                        } catch (recoveryError) {
                            console.error(`❌ [VaultCreated] Error recovering vaultId:`, recoveryError.message);
                            continue; // Skip this event
                        }
                    } else {
                        // Normal string extraction
                        vaultId = extractStringArg(vaultId);
                    }
                    
                    // Validate vaultId is not empty (should be like "xfzdqmq")
                    if (!vaultId || vaultId === '') {
                        console.error('❌ [VaultCreated] Failed to extract vaultId from event');
                        continue; // Skip this event
                    }
                    
                    await processVaultCreated(
                        vaultId,
                        owner,
                        cid,
                        releaseTimestamp,
                        event.blockNumber,
                        event.transactionHash
                    );
                }
            }
            
            // Get AccessGranted events
            const accessGrantedFilter = contract.filters.AccessGranted();
            const accessGrantedEvents = await contract.queryFilter(
                accessGrantedFilter,
                fromBlock,
                toBlock
            );
            
            for (const event of accessGrantedEvents) {
                if (event.args) {
                    let vaultId = event.args.vaultId || event.args[0];
                    const heir = extractStringArg(event.args.heir || event.args[1]);
                    
                    // Handle indexed vaultId - try to recover from transaction input
                    if (vaultId && typeof vaultId === 'object' && vaultId._isIndexed === true) {
                        console.log(`🔍 [AccessGranted] vaultId is indexed, attempting recovery from transaction input...`);
                        try {
                            // Get the transaction to decode the input data
                            const tx = await provider.getTransaction(event.transactionHash);
                            
                            if (!tx || !tx.data) {
                                console.warn(`⚠️  [AccessGranted] Could not get transaction data. Skipping.`);
                                continue;
                            }
                            
                            // Try to decode the transaction input to get the vaultId parameter
                            let decodedVaultId = null;
                            
                            try {
                                // Try grantAccessToMultiple first (most common)
                                const iface = contract.interface || new ethers.Interface(CONTRACT_ABI);
                                const decoded = iface.parseTransaction({ data: tx.data });
                                
                                if (decoded && decoded.name === 'grantAccessToMultiple') {
                                    decodedVaultId = decoded.args[0]; // First parameter is vaultId
                                    console.log(`✅ [AccessGranted] Decoded vaultId from grantAccessToMultiple: ${decodedVaultId}`);
                                } else if (decoded && decoded.name === 'grantAccess') {
                                    decodedVaultId = decoded.args[0]; // First parameter is vaultId
                                    console.log(`✅ [AccessGranted] Decoded vaultId from grantAccess: ${decodedVaultId}`);
                                }
                            } catch (decodeError) {
                                console.warn(`⚠️  [AccessGranted] Could not decode transaction input:`, decodeError.message);
                            }
                            
                            if (decodedVaultId) {
                                vaultId = String(decodedVaultId);
                                console.log(`✅ [AccessGranted] Recovered vaultId from transaction: ${vaultId}`);
                            } else {
                                // Fallback: Try to find by checking which vault was granted access in this transaction
                                // by checking the block number and transaction hash against recent events
                                console.log(`🔍 [AccessGranted] Fallback: Checking vaults for transaction sender...`);
                                const owner = tx.from;
                                
                                if (!owner) {
                                    console.warn(`⚠️  [AccessGranted] Could not get transaction sender. Skipping.`);
                                    continue;
                                }
                                
                                // Get all vaults for this owner
                                const userVaults = await contract.getUserVaults(owner);
                                
                                // Check which vault has this heir authorized AND was created before this block
                                // This helps narrow down to the correct vault
                                let foundVaultId = null;
                                
                                for (const candidateVaultId of userVaults) {
                                    try {
                                        const vaultIdStr = String(candidateVaultId);
                                        const isAuthorized = await contract.authorizedHeirs(vaultIdStr, heir);
                                        
                                        // Additional check: verify this vault exists and was created before this event
                                        const vaultExists = await contract.vaultExists(vaultIdStr);
                                        if (isAuthorized && vaultExists) {
                                            // Prefer the most recently created vault that matches
                                            // (This is still imperfect but better than first match)
                                            foundVaultId = vaultIdStr;
                                        }
                                    } catch (err) {
                                        // Continue checking other vaults
                                        continue;
                                    }
                                }
                                
                                if (foundVaultId) {
                                    vaultId = foundVaultId;
                                    console.log(`✅ [AccessGranted] Recovered vaultId: ${foundVaultId} (fallback match)`);
                                } else {
                                    console.warn(`⚠️  [AccessGranted] Could not recover vaultId from indexed parameter. Skipping event.`);
                                    continue;
                                }
                            }
                        } catch (recoveryError) {
                            console.error(`❌ [AccessGranted] Error recovering vaultId:`, recoveryError);
                            continue;
                        }
                    } else {
                        // Extract normally if not indexed
                        vaultId = extractStringArg(vaultId);
                    }
                    
                    // Validate vaultId is not empty
                    if (!vaultId || vaultId === '') {
                        console.error(`⚠️  [AccessGranted] Failed to extract vaultId from event. Skipping.`);
                        continue;
                    }
                    
                    await processAccessGranted(
                        vaultId,
                        heir,
                        event.blockNumber,
                        event.transactionHash
                    );
                }
            }
            
            // Get AccessRevoked events
            const accessRevokedFilter = contract.filters.AccessRevoked();
            const accessRevokedEvents = await contract.queryFilter(
                accessRevokedFilter,
                fromBlock,
                toBlock
            );
            
            for (const event of accessRevokedEvents) {
                if (event.args) {
                    let vaultId = event.args.vaultId || event.args[0];
                    const heir = extractStringArg(event.args.heir || event.args[1]);
                    
                    // Handle indexed vaultId - try to recover from transaction input
                    if (vaultId && typeof vaultId === 'object' && vaultId._isIndexed === true) {
                        console.log(`🔍 [AccessRevoked] vaultId is indexed, attempting recovery from transaction input...`);
                        try {
                            // Get the transaction to decode the input data
                            const tx = await provider.getTransaction(event.transactionHash);
                            
                            if (!tx || !tx.data) {
                                console.warn(`⚠️  [AccessRevoked] Could not get transaction data. Skipping.`);
                                continue;
                            }
                            
                            // Try to decode the transaction input to get the vaultId parameter
                            let decodedVaultId = null;
                            
                            try {
                                // Try revokeAccess
                                const iface = contract.interface || new ethers.Interface(CONTRACT_ABI);
                                const decoded = iface.parseTransaction({ data: tx.data });
                                
                                if (decoded && decoded.name === 'revokeAccess') {
                                    decodedVaultId = decoded.args[0]; // First parameter is vaultId
                                    console.log(`✅ [AccessRevoked] Decoded vaultId from revokeAccess: ${decodedVaultId}`);
                                }
                            } catch (decodeError) {
                                console.warn(`⚠️  [AccessRevoked] Could not decode transaction input:`, decodeError.message);
                            }
                            
                            if (decodedVaultId) {
                                vaultId = String(decodedVaultId);
                                console.log(`✅ [AccessRevoked] Recovered vaultId from transaction: ${vaultId}`);
                            } else {
                                // Fallback: Check database for recently revoked heirs
                                console.log(`🔍 [AccessRevoked] Fallback: Checking database for recently revoked heirs...`);
                                const owner = tx.from;
                                
                                if (!owner) {
                                    console.warn(`⚠️  [AccessRevoked] Could not get transaction sender. Skipping.`);
                                    continue;
                                }
                                
                                // Check database first - see if we have any vaults with this heir that were recently revoked
                                let foundVaultId = null;
                                
                                const { data: heirRecords } = await supabase
                                    .from('heirs')
                                    .select('vault_id')
                                    .eq('heir_address', heir.toLowerCase())
                                    .eq('is_active', false) // Recently revoked
                                    .order('revoked_at', { ascending: false })
                                    .limit(1);
                                
                                if (heirRecords && heirRecords.length > 0) {
                                    // Check if this vault belongs to the owner
                                    const candidateVaultId = heirRecords[0].vault_id;
                                    const { data: vault } = await supabase
                                        .from('vaults')
                                        .select('owner_address')
                                        .eq('vault_id', candidateVaultId)
                                        .single();
                                    
                                    if (vault && vault.owner_address.toLowerCase() === owner.toLowerCase()) {
                                        foundVaultId = candidateVaultId;
                                    }
                                }
                                
                                // If not found in DB, try querying contract (less reliable for revoked)
                                if (!foundVaultId) {
                                    // Query all vaults for this owner
                                    const userVaults = await contract.getUserVaults(owner);
                                    
                                    // Check recent vaults - if a vault had this heir and it was revoked recently
                                    // This is a best-effort approach
                                    for (const vid of userVaults.slice(0, 10)) { // Check first 10 vaults
                                        // We can't check if heir was revoked, but we can check if vault exists
                                        // and belongs to owner (already verified by getUserVaults)
                                        foundVaultId = vid; // Use first vault as fallback (not ideal)
                                        break;
                                    }
                                }
                                
                                if (foundVaultId) {
                                    vaultId = foundVaultId;
                                    console.log(`✅ [AccessRevoked] Recovered vaultId: ${vaultId} (fallback match)`);
                                } else {
                                    console.warn(`⚠️  [AccessRevoked] Could not recover vaultId for owner ${owner} with heir ${heir}. Skipping.`);
                                    continue;
                                }
                            }
                        } catch (recoveryError) {
                            console.error(`❌ [AccessRevoked] Error recovering vaultId:`, recoveryError.message);
                            continue;
                        }
                    } else {
                        // Normal string extraction
                        vaultId = extractStringArg(vaultId);
                    }
                    
                    if (!vaultId || vaultId === '') {
                        console.error('❌ [AccessRevoked] Failed to extract vaultId');
                        continue;
                    }
                    
                    await processAccessRevoked(
                        vaultId,
                        heir,
                        event.blockNumber,
                        event.transactionHash
                    );
                }
            }
            
            // Get ReleaseTimeExtended events
            const releaseTimeExtendedFilter = contract.filters.ReleaseTimeExtended();
            const releaseTimeExtendedEvents = await contract.queryFilter(
                releaseTimeExtendedFilter,
                fromBlock,
                toBlock
            );
            
            for (const event of releaseTimeExtendedEvents) {
                if (event.args) {
                    let vaultId = event.args.vaultId || event.args[0];
                    const newTimestamp = Number(event.args.newTimestamp || event.args[1]);
                    
                    // Handle indexed vaultId - try to recover it from the transaction
                    if (vaultId && typeof vaultId === 'object' && vaultId._isIndexed === true) {
                        console.log(`🔍 [ReleaseTimeExtended] vaultId is indexed, attempting recovery from transaction...`);
                        try {
                            // Get the transaction receipt to find the vault owner
                            const receipt = await provider.getTransactionReceipt(event.transactionHash);
                            if (!receipt) {
                                console.warn(`⚠️  [ReleaseTimeExtended] Could not get transaction receipt. Skipping.`);
                                continue;
                            }
                            
                            // Find the from address (vault owner who extended the time)
                            const tx = await provider.getTransaction(event.transactionHash);
                            const owner = tx.from;
                            
                            if (!owner) {
                                console.warn(`⚠️  [ReleaseTimeExtended] Could not get transaction sender. Skipping.`);
                                continue;
                            }
                            
                            // Query all vaults for this owner and find which one matches the new timestamp
                            console.log(`🔍 [ReleaseTimeExtended] Querying vaults for owner ${owner} to find matching vault...`);
                            const userVaults = await contract.getUserVaults(owner);
                            
                            let foundVaultId = null;
                            for (const vid of userVaults) {
                                try {
                                    const metadata = await contract.getVaultMetadata(vid);
                                    if (metadata && metadata[2]) { // metadata[2] is releaseTimestamp
                                        const vaultReleaseTime = Number(metadata[2]);
                                        // Check if this vault's release time matches the new timestamp
                                        // (allowing for small differences due to block time)
                                        if (Math.abs(vaultReleaseTime - newTimestamp) < 60) { // Within 60 seconds
                                            foundVaultId = vid;
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    // Continue searching
                                }
                            }
                            
                            if (foundVaultId) {
                                vaultId = foundVaultId;
                                console.log(`✅ [ReleaseTimeExtended] Recovered vaultId: ${vaultId}`);
                            } else {
                                console.warn(`⚠️  [ReleaseTimeExtended] Could not recover vaultId for owner ${owner} with timestamp ${newTimestamp}. Skipping.`);
                                continue;
                            }
                        } catch (recoveryError) {
                            console.error(`❌ [ReleaseTimeExtended] Error recovering vaultId:`, recoveryError.message);
                            continue;
                        }
                    } else {
                        // Normal string extraction
                        vaultId = extractStringArg(vaultId);
                    }
                    
                    if (!vaultId || vaultId === '') {
                        console.error('❌ [ReleaseTimeExtended] Failed to extract vaultId');
                        continue;
                    }
                    
                    await processReleaseTimeExtended(
                        vaultId,
                        newTimestamp,
                        event.blockNumber,
                        event.transactionHash
                    );
                }
            }
            
            // Update last processed block
            await updateLastProcessedBlock(toBlock);
            
            fromBlock = toBlock + 1;
        }
        
            console.log(`✅ Indexing complete. Processed up to block ${currentBlock}`);
    } catch (error) {
        console.error('❌ Error indexing events:', error);
        throw error;
    }
}

/**
 * Start the indexer
 */
async function startIndexer() {
    console.log('🚀 Starting Legacy Vault indexer...');
    console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL.replace(/\/v2\/[^/]+$/, '/v2/***')}`); // Hide API key in logs
    console.log(`💾 Supabase: ${SUPABASE_URL}`);
    console.log('ℹ️  Note: Starting from current block (historical backfill skipped)');
    
    // Run indexing every 30 seconds
    setInterval(async () => {
        try {
            await indexEvents();
        } catch (error) {
            console.error('❌ Indexing error:', error);
        }
    }, 30000);
    
    // Initial index
    await indexEvents();
}

// Run if executed directly
startIndexer().catch(console.error);

