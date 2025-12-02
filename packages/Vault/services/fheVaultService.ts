/**
 * FHE Vault Service
 * High-level service that orchestrates encryption, IPFS, FHE, and contract interactions
 * Updated to use wagmi and FHEVM SDK hooks pattern
 */

import {
    generateAESKey,
    encryptForIPFS,
    decryptFromIPFS,
    exportKey,
    importKey,
} from '../utils/encryption';
import {
    uploadToIPFS,
    downloadFromIPFSAsText,
} from './ipfsService';
import {
    keyToNumber,
    numberToKey,
} from '../utils/fheUtils';
import { ethers } from 'ethers';
import { VAULT_ABI } from './vaultContractService';

export interface CreateVaultParams {
    vaultId: string; // Random alphanumeric vault ID (e.g., "x5gsyts")
    data: string | File;
    releaseTimestamp: number;
    contractAddress: string;
    signer: ethers.Signer;
    userAddress: string;
    encryptFn: (contractAddress: string, value: number | bigint) => Promise<{ encryptedData: any; proof: string }>;
    metadata?: {
        name?: string;
        description?: string;
    };
}

export interface CreateVaultResult {
    vaultId: string;
    cid: string;
    aesKey: CryptoKey; // Store this securely - needed for owner access
}

export interface UnlockVaultParams {
    vaultId: string;
    contractAddress: string;
    provider: ethers.Provider;
    signer: ethers.Signer;
    userAddress: string;
    decryptFn: (handle: string, contractAddress: string) => Promise<number | bigint>;
    isOwner?: boolean;
}

/**
 * Create a new vault with encrypted data
 */
export async function createVault(params: CreateVaultParams): Promise<CreateVaultResult> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🏦 [VAULT] Starting vault creation process');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📝 [VAULT] Vault ID: ${params.vaultId}`);
    console.log(`📝 [VAULT] Data type: ${params.data instanceof File ? 'File' : 'String'}`);
    console.log(`📝 [VAULT] Release timestamp: ${new Date(params.releaseTimestamp * 1000).toISOString()}`);
    
    const { data, releaseTimestamp, contractAddress, signer, userAddress, metadata } = params;

    // Step 1: Generate AES key
    console.log('\n📌 Step 1: Generate AES-256-GCM Key');
    const aesKey = await generateAESKey();
    const keyBuffer = await exportKey(aesKey);
    console.log(`   Key size: ${keyBuffer.byteLength} bytes (256 bits)`);

    // Step 2: Encrypt data with AES
    console.log('\n📌 Step 2: Encrypt Data with AES-256-GCM');
    let encryptedData: string;
    if (data instanceof File) {
        console.log(`   File name: ${data.name}`);
        console.log(`   File size: ${data.size} bytes`);
        console.log(`   File type: ${data.type}`);
        const fileBuffer = await data.arrayBuffer();
        encryptedData = await encryptForIPFS(fileBuffer, aesKey);
    } else {
        console.log(`   Text length: ${data.length} characters`);
        encryptedData = await encryptForIPFS(data, aesKey);
    }

    // Step 3: Upload encrypted data to IPFS
    console.log('\n📌 Step 3: Upload Encrypted Data to IPFS');
    console.log('   Starting IPFS upload...');
    let cid: string;
    try {
        // Build keyvalues with file metadata if it's a file
        const keyvalues: Record<string, string> = {
            type: data instanceof File ? 'file' : 'text',
            timestamp: Date.now().toString(),
        };
        
        // Add file-specific metadata if it's a file
        if (data instanceof File) {
            keyvalues.fileName = data.name;
            keyvalues.mimeType = data.type || 'application/octet-stream';
        }
        
        cid = await uploadToIPFS(encryptedData, {
            name: metadata?.name || 'vault-data',
            keyvalues: keyvalues,
        });
        console.log(`✅ [VAULT] IPFS CID obtained: ${cid}`);
        console.log(`   IPFS Gateway: https://gateway.pinata.cloud/ipfs/${cid}`);
    } catch (ipfsError: any) {
        console.error('❌ [VAULT] IPFS upload failed:', ipfsError);
        throw new Error(`IPFS upload failed: ${ipfsError?.message || 'Unknown error'}. Please check your Pinata JWT configuration.`);
    }

    // Step 4: Convert AES key to number for FHE encryption
    console.log('\n📌 Step 4: Convert AES Key to Number for FHE');
    console.log('   Using euint256 to store full 32-byte AES key (no data loss)');
    const keyNumber = keyToNumber(keyBuffer);
    console.log(`   Key number (BigInt): ${keyNumber.toString()}`);
    console.log(`   Key number (hex): 0x${keyNumber.toString(16).padStart(64, '0')}`);
    console.log(`   ✅ Full 32-byte key converted to 256-bit value`);

    // Step 5: Encrypt AES key with FHE using the provided encrypt function
    console.log('\n📌 Step 5: Encrypt AES Key with FHEVM (256-bit)');
    console.log(`   Contract address: ${contractAddress}`);
    console.log(`   Encrypting 256-bit key value...`);
    const { encryptedData: encryptedKey, proof } = await params.encryptFn(
        contractAddress,
        keyNumber
    );
    console.log('✅ [VAULT] FHE encryption complete');
    if (Array.isArray(encryptedKey)) {
        console.log(`   Encrypted key tuple: [${encryptedKey[0]}, ${typeof encryptedKey[1] === 'string' ? encryptedKey[1].substring(0, 20) + '...' : 'bytes32'}]`);
    } else {
        console.log(`   Encrypted key handle: ${String(encryptedKey).substring(0, 100)}...`);
    }
    const proofLength = typeof proof === 'string' ? proof.length : (proof as Uint8Array).byteLength;
    console.log(`   Proof length: ${proofLength} bytes`);

    // Step 6: Create vault on-chain
    console.log('\n📌 Step 6: Create Vault on Blockchain');
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Vault ID: ${params.vaultId}`);
    console.log(`   CID: ${cid}`);
    console.log(`   Release time: ${new Date(releaseTimestamp * 1000).toISOString()}`);
    
    const contract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
    
    // Pre-flight checks
    console.log('   Performing pre-flight checks...');
    try {
        const provider = signer.provider;
        if (provider) {
            // Check current block timestamp
            const currentBlock = await provider.getBlock('latest');
            const currentTimestamp = currentBlock?.timestamp || 0;
            console.log(`   Current block timestamp: ${currentTimestamp} (${new Date(currentTimestamp * 1000).toISOString()})`);
            console.log(`   Release timestamp: ${releaseTimestamp} (${new Date(releaseTimestamp * 1000).toISOString()})`);
            
            if (releaseTimestamp <= currentTimestamp) {
                throw new Error(`Release timestamp must be in the future. Current: ${currentTimestamp}, Release: ${releaseTimestamp}`);
            }
            console.log(`   ✓ Release timestamp is in the future`);
            
            // Check if vault already exists
            const readContract = new ethers.Contract(contractAddress, VAULT_ABI, provider);
            const vaultExists = await readContract.vaultExists(params.vaultId);
            if (vaultExists) {
                throw new Error(`Vault ID "${params.vaultId}" already exists. Please use a different vault ID.`);
            }
            console.log(`   ✓ Vault ID "${params.vaultId}" is available`);
        }
    } catch (preflightError: any) {
        if (preflightError.message.includes('must be in the future')) {
            throw preflightError;
        }
        console.warn('   ⚠️ Pre-flight checks failed, but continuing:', preflightError.message);
    }
    
    console.log('   Sending transaction...');
    console.log('   Parameters:');
    console.log(`     vaultId: ${params.vaultId}`);
    console.log(`     cid: ${cid}`);
    console.log(`     encryptedKey: ${typeof encryptedKey === 'string' ? encryptedKey : JSON.stringify(encryptedKey)}`);
    console.log(`     proof: ${typeof proof === 'string' ? proof.substring(0, 50) + '...' : 'Uint8Array'}`);
    console.log(`     releaseTimestamp: ${releaseTimestamp} (${new Date(releaseTimestamp * 1000).toISOString()})`);
    
    // Validate encrypted key format
    if (typeof encryptedKey !== 'string' || !encryptedKey.startsWith('0x') || encryptedKey.length !== 66) {
        throw new Error(`Invalid encrypted key format. Expected 32-byte hex string (66 chars with 0x), got: ${typeof encryptedKey} ${encryptedKey?.length || 0} chars`);
    }
    console.log(`   ✓ Encrypted key format is valid (32 bytes)`);
    
    // Validate proof format
    if (typeof proof !== 'string' || !proof.startsWith('0x')) {
        throw new Error(`Invalid proof format. Expected hex string, got: ${typeof proof}`);
    }
    console.log(`   ✓ Proof format is valid (${proof.length} chars)`);
    
    // Try to estimate gas first to get better error message
    try {
      const gasEstimate = await contract.createVault.estimateGas(params.vaultId, cid, encryptedKey, proof, releaseTimestamp);
      console.log(`   ✓ Gas estimate: ${gasEstimate.toString()}`);
    } catch (estimateError: any) {
      console.error('   ❌ Gas estimation failed:', estimateError);
      
      // Try to extract revert reason
      let revertReason = 'Unknown error';
      if (estimateError?.data) {
        console.error('   Revert data:', estimateError.data);
        // Try to decode as string (Solidity error messages)
        try {
          const decoded = contract.interface.parseError(estimateError.data);
          console.error('   Decoded error:', decoded);
          revertReason = decoded?.name || 'Contract revert';
        } catch (e) {
          // Try to extract error message from data
          try {
            // Error messages are often in the data
            const dataStr = estimateError.data.toString();
            if (dataStr.includes('Vault ID')) {
              revertReason = 'Vault ID validation failed';
            } else if (dataStr.includes('Release time')) {
              revertReason = 'Release time must be in the future';
            } else if (dataStr.includes('already exists')) {
              revertReason = 'Vault ID already exists';
            } else if (dataStr.includes('CID')) {
              revertReason = 'CID validation failed';
            }
          } catch (e2) {
            // Ignore
          }
        }
      }
      if (estimateError?.reason) {
        console.error('   Revert reason:', estimateError.reason);
        revertReason = estimateError.reason;
      }
      
      throw new Error(`Transaction would fail: ${revertReason}. Please check: 1) Vault ID is unique, 2) Release time is in the future, 3) All parameters are valid.`);
    }
    
    const tx = await contract.createVault(params.vaultId, cid, encryptedKey, proof, releaseTimestamp);
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...');

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log('✅ [VAULT] Transaction confirmed!');
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ [VAULT] Vault creation complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Vault ID: ${params.vaultId}`);
    console.log(`   IPFS CID: ${cid}`);
    console.log(`   View on IPFS: https://gateway.pinata.cloud/ipfs/${cid}`);
    console.log('═══════════════════════════════════════════════════════\n');

    return {
        vaultId: params.vaultId,
        cid,
        aesKey, // IMPORTANT: Store this securely - needed for owner to decrypt
    };
}

/**
 * Unlock vault and decrypt data
 */
export async function unlockVault(params: UnlockVaultParams): Promise<string | ArrayBuffer> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔓 [VAULT] Starting vault unlock process');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📝 [VAULT] Vault ID: ${params.vaultId}`);
    console.log(`📝 [VAULT] Access type: ${params.isOwner ? 'Owner' : 'Heir'}`);
    
    const { vaultId, contractAddress, provider, signer, userAddress, isOwner = false } = params;

    // Step 1: Get vault metadata
    console.log('\n📌 Step 1: Get Vault Metadata from Contract');
    const readContract = new ethers.Contract(contractAddress, VAULT_ABI, provider);
    const metadata = await readContract.getVaultMetadata(vaultId);
    const { cid, owner, releaseTimestamp, createdAt } = metadata;
    console.log(`   Owner: ${owner}`);
    console.log(`   CID: ${cid}`);
    console.log(`   Release time: ${new Date(Number(releaseTimestamp) * 1000).toISOString()}`);
    console.log(`   Created: ${new Date(Number(createdAt) * 1000).toISOString()}`);

    // Step 2: Get encrypted key handle from contract
    // Note: getEncryptedKeyAsOwner checks msg.sender, so we need to use signer, not provider
    console.log('\n📌 Step 2: Get Encrypted Key Handle from Contract');
    let encryptedKeyHandle: string;
    try {
        if (isOwner) {
            console.log('   Using owner access (can access anytime)');
            console.log(`   Calling getEncryptedKeyAsOwner with signer address: ${await signer.getAddress()}`);
            // Use signer for view functions that check msg.sender
            const writeContract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
            encryptedKeyHandle = await writeContract.getEncryptedKeyAsOwner(vaultId);
        } else {
            console.log('   Using heir access (must wait for release time)');
            console.log(`   Calling getEncryptedKey with signer address: ${await signer.getAddress()}`);
            // Use signer for view functions that check msg.sender
            const writeContract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
            encryptedKeyHandle = await writeContract.getEncryptedKey(vaultId);
        }
        
        // Validate handle format (should be bytes32 = 66 chars with 0x prefix)
        if (!encryptedKeyHandle || typeof encryptedKeyHandle !== 'string') {
            throw new Error('Invalid handle returned from contract');
        }
        if (!encryptedKeyHandle.startsWith('0x') || encryptedKeyHandle.length !== 66) {
            throw new Error(`Invalid handle format. Expected 66-char hex string, got: ${encryptedKeyHandle}`);
        }
        console.log(`✅ Encrypted key handle obtained: ${encryptedKeyHandle}`);
    } catch (error: any) {
        console.error('   ❌ Error getting encrypted key handle:', error);
        if (error?.message?.includes('Only owner can access')) {
            throw new Error('Access denied: You are not the owner of this vault. Make sure you are connected with the correct wallet.');
        }
        if (error?.message?.includes('Not authorized')) {
            throw new Error('Access denied: You are not authorized to access this vault.');
        }
        if (error?.message?.includes('Release time not reached')) {
            throw new Error('Vault is still locked. Release time has not been reached yet.');
        }
        throw new Error(`Failed to get encrypted key: ${error?.message || error}`);
    }

    // Step 3: Decrypt FHE-encrypted key using userDecrypt
    // userDecrypt will fetch the ciphertext (CT) from the contract on-chain and decrypt it
    console.log('\n📌 Step 3: Decrypt FHE-Encrypted Key using userDecrypt (256-bit)');
    console.log('   userDecrypt will fetch CT from contract and decrypt...');
    const keyNumber = await params.decryptFn(encryptedKeyHandle, contractAddress);
    console.log(`✅ Key decrypted: ${keyNumber}`);
    console.log(`   Key type: ${typeof keyNumber}`);
    
    // Convert to BigInt to preserve precision and get hex representation
    const keyBigInt = typeof keyNumber === 'bigint' ? keyNumber : BigInt(Math.floor(Number(keyNumber)));
    console.log(`   Key (BigInt): ${keyBigInt.toString()}`);
    console.log(`   Key (hex): 0x${keyBigInt.toString(16).padStart(64, '0')}`);
    console.log(`   ✅ Decrypted 256-bit value - full 32-byte key preserved`);

    // Step 4: Convert number back to AES key
    console.log('\n📌 Step 4: Convert Number to AES Key');
    console.log('   ✅ Using euint256 - all 32 bytes of the key are stored in FHE');
    console.log('   ✅ No data loss - full key can be perfectly reconstructed');
    const keyBuffer = numberToKey(keyBigInt);
    console.log(`   Key buffer size: ${keyBuffer.byteLength} bytes`);
    const aesKey = await importKey(keyBuffer);
    console.log('✅ AES key imported');

    // Step 5: Download encrypted data from IPFS
    console.log('\n📌 Step 5: Download Encrypted Data from IPFS');
    const encryptedData = await downloadFromIPFSAsText(cid);
    console.log(`   Downloaded data length: ${encryptedData.length} chars`);

    // Step 6: Decrypt data with AES key
    console.log('\n📌 Step 6: Decrypt Data with AES-256-GCM');
    console.log('   Decrypting...');
    const decrypted = await decryptFromIPFS(encryptedData, aesKey);
    console.log(`✅ Decryption complete`);
    console.log(`   Decrypted size: ${decrypted.byteLength} bytes`);

    // Step 7: Return ArrayBuffer (caller can convert to string if needed for text)
    // This preserves binary data for files
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ [VAULT] Vault unlocked successfully!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Decrypted data size: ${decrypted.byteLength} bytes`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    return decrypted;
}

/**
 * Grant access to a heir
 */
export async function grantHeirAccess(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    heirAddress: string
): Promise<ethers.ContractTransactionResponse> {
    const contract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
    return await contract.grantAccess(vaultId, heirAddress);
}

/**
 * Revoke access from a heir
 */
export async function revokeHeirAccess(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    heirAddress: string
): Promise<ethers.ContractTransactionResponse> {
    const contract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
    return await contract.revokeAccess(vaultId, heirAddress);
}

/**
 * Extend release time
 */
export async function extendVaultReleaseTime(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    newTimestamp: number
): Promise<ethers.ContractTransactionResponse> {
    const contract = new ethers.Contract(contractAddress, VAULT_ABI, signer);
    return await contract.extendReleaseTime(vaultId, newTimestamp);
}

/**
 * Get user's vaults
 */
export async function getUserVaultsList(
    contractAddress: string,
    provider: ethers.Provider,
    userAddress: string
): Promise<string[]> {
    const contract = new ethers.Contract(contractAddress, VAULT_ABI, provider);
    return await contract.getUserVaults(userAddress);
}

