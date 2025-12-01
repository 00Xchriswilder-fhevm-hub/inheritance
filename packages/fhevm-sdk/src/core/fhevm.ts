/**
 * Universal FHEVM SDK - Consolidated Instance
 * Complete FHEVM functionality in a single file for NPX packages
 * Includes: FHEVM instance, encryption, and decryption
 * Updated for FHEVM 0.9 with RelayerSDK 0.3.0-6
 */

import { ethers } from 'ethers';

let fheInstance: any = null;

/**
 * Initialize FHEVM instance
 * Uses CDN for browser environments to avoid bundling issues
 * Updated for RelayerSDK 0.3.0-6 (FHEVM 0.9)
 */
export async function initializeFheInstance(options?: { rpcUrl?: string }) {
  // Detect environment
  if (typeof window !== 'undefined' && window.ethereum) {
    // Browser environment
    return initializeBrowserFheInstance();
  } else {
    // Node.js environment - use new functionality
    return initializeNodeFheInstance(options?.rpcUrl);
  }
}

/**
 * Initialize FHEVM instance for browser environment
 */
async function initializeBrowserFheInstance() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.');
  }

  // Check for both uppercase and lowercase versions of RelayerSDK
  let sdk = (window as any).RelayerSDK || (window as any).relayerSDK;
  
  if (!sdk) {
    throw new Error('RelayerSDK not loaded. Please include the script tag in your HTML:\n<script src="https://cdn.zama.org/relayer-sdk-js/0.3.0-6/relayer-sdk-js.umd.cjs"></script>');
  }

  const { initSDK, createInstance, SepoliaConfig } = sdk;

  // Initialize SDK with CDN
  await initSDK();
    console.log('✅ FHEVM SDK initialized with CDN');
  
  const config = { ...SepoliaConfig, network: window.ethereum };
  
  try {
    fheInstance = await createInstance(config);
    return fheInstance;
  } catch (err) {
    console.error('FHEVM browser instance creation failed:', err);
    throw err;
  }
}

/**
 * Initialize FHEVM instance for Node.js environment
 * REAL FUNCTIONALITY - uses actual RelayerSDK
 */
async function initializeNodeFheInstance(rpcUrl?: string) {
  try {
    console.log('🚀 Initializing REAL FHEVM Node.js instance...');
    
    // Use eval to prevent webpack from analyzing these imports
    const relayerSDKModule = await eval('import("@zama-fhe/relayer-sdk/node")');
    const { createInstance, SepoliaConfig, generateKeypair } = relayerSDKModule;
    
    // Create an EIP-1193 compatible provider for Node.js
    const ethersModule = await eval('import("ethers")');
    const provider = new ethersModule.ethers.JsonRpcProvider(rpcUrl || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
    
    // Create EIP-1193 provider wrapper
    const eip1193Provider = {
      request: async ({ method, params }: { method: string; params: any[] }) => {
        switch (method) {
          case 'eth_chainId':
            return '0xaa36a7'; // Sepolia chain ID
          case 'eth_accounts':
            return ['---YOUR-ADDRESS-HERE---'];
          case 'eth_requestAccounts':
            return ['---YOUR-ADDRESS-HERE---'];
          case 'eth_call':
            // Use the real provider for blockchain calls
            return await provider.call(params[0]);
          case 'eth_sendTransaction':
            // Use the real provider for transactions
            return await provider.broadcastTransaction(params[0]);
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      },
      on: () => {},
      removeListener: () => {}
    };
    
    const config = { 
      ...SepoliaConfig, 
      network: eip1193Provider 
    };
    
    fheInstance = await createInstance(config);
    console.log('✅ REAL FHEVM Node.js instance created successfully!');
    return fheInstance;
  } catch (err) {
    console.error('FHEVM Node.js instance creation failed:', err);
    throw err;
  }
}

export function getFheInstance() {
  return fheInstance;
}

/**
 * Decrypt a single encrypted value using EIP-712 user decryption (matches showcase API)
 */
export async function decryptValue(encryptedBytes: string, contractAddress: string, signer: any): Promise<number | bigint> {
  const fhe = getFheInstance();
  if (!fhe) throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');

  try {
    console.log('🔐 Using EIP-712 user decryption for handle:', encryptedBytes);
    
    // Use EIP-712 user decryption instead of public decryption
    const keypair = fhe.generateKeypair();
    const handleContractPairs = [
      {
        handle: encryptedBytes,
        contractAddress: contractAddress,
      },
    ];
    
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    const contractAddresses = [contractAddress];

    const eip712 = fhe.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );

    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message
    );

    const result = await fhe.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      await signer.getAddress(),
      startTimeStamp,
      durationDays
    );

    const decryptedValue = result[encryptedBytes];
    
    // For 256-bit values, preserve as BigInt to avoid precision loss
    // For smaller values, return as number for compatibility
    if (typeof decryptedValue === 'bigint') {
      // Check if it's a 256-bit value (larger than Number.MAX_SAFE_INTEGER)
      if (decryptedValue > BigInt(Number.MAX_SAFE_INTEGER)) {
        console.log('🔓 Returning BigInt for 256-bit value to preserve precision');
        return decryptedValue as any; // Return as BigInt
      }
      return Number(decryptedValue);
    }
    
    return Number(decryptedValue);
  } catch (error: any) {
    // Check for relayer/network error
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
      throw new Error('Decryption service is temporarily unavailable. Please try again later.');
    }
    throw error;
  }
}

/**
 * Batch decrypt multiple encrypted values using EIP-712 user decryption
 */
export async function batchDecryptValues(
  handles: string[], 
  contractAddress: string, 
  signer: any
): Promise<Record<string, number>> {
  const fhe = getFheInstance();
  if (!fhe) throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');

  try {
    console.log('🔐 Using EIP-712 batch user decryption for handles:', handles);
    
    const keypair = fhe.generateKeypair();
    const handleContractPairs = handles.map(handle => ({
      handle,
      contractAddress: contractAddress,
    }));
    
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    const contractAddresses = [contractAddress];

    const eip712 = fhe.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );

    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message
    );

    const result = await fhe.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      await signer.getAddress(),
      startTimeStamp,
      durationDays
    );

    // Convert result to numbers
    const decryptedValues: Record<string, number> = {};
    for (const handle of handles) {
      decryptedValues[handle] = Number(result[handle]);
    }

    return decryptedValues;
  } catch (error: any) {
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
      throw new Error('Decryption service is temporarily unavailable. Please try again later.');
    }
    throw error;
  }
}

/**
 * Encrypt values using FHEVM
 * 
 * 📝 BIT SIZE SUPPORT:
 * FHEVM supports different bit sizes for encrypted values. If your contract uses a different bit size
 * than the default 32-bit, you can use the appropriate method:
 * - add8(value)   - for 8-bit values (0-255)
 * - add16(value) - for 16-bit values (0-65535) 
 * - add32(value) - for 32-bit values (0-4294967295) - DEFAULT
 * - add64(value) - for 64-bit values (0-18446744073709551615)
 * - add128(value) - for 128-bit values
 * - add256(value) - for 256-bit values
 * 
 * Example: If your contract expects 8-bit values, replace add32() with add8()
 */
export async function encryptValue(
  contractAddress: string,
  address: string,
  plainDigits: number[]
) {
  const relayer = getFheInstance();
  if (!relayer) throw new Error("FHEVM not initialized");

  const inputHandle = relayer.createEncryptedInput(contractAddress, address);
  for (const d of plainDigits) {
    inputHandle.add8(d);
  }
  
  const ciphertextBlob = await inputHandle.encrypt();
  return ciphertextBlob;
}

/**
 * Create encrypted input for contract interaction (matches showcase API)
 * @param contractAddress The contract address
 * @param userAddress The user's wallet address
 * @param value The numeric value to encrypt
 * @param bitSize Optional bit size (8, 16, 32, 64, 128, 256). Defaults to 128 for euint128 contracts
 */
export async function createEncryptedInput(
  contractAddress: string, 
  userAddress: string, 
  value: number | bigint,
  bitSize: 8 | 16 | 32 | 64 | 128 | 256 = 128
) {
  const fhe = getFheInstance();
  if (!fhe) throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');

  console.log(`🔐 Creating encrypted input for contract ${contractAddress}, user ${userAddress}, value ${value}, bitSize ${bitSize}`);
  
  const inputHandle = fhe.createEncryptedInput(contractAddress, userAddress);
  
  // Use the appropriate bit size method based on contract type
  // Convert value to BigInt to handle large 128-bit values
  const bigIntValue = typeof value === 'bigint' ? value : BigInt(value);
  
  switch (bitSize) {
    case 8:
      inputHandle.add8(bigIntValue);
      break;
    case 16:
      inputHandle.add16(bigIntValue);
      break;
    case 32:
      inputHandle.add32(bigIntValue);
      break;
    case 64:
      inputHandle.add64(bigIntValue);
      break;
    case 128:
      inputHandle.add128(bigIntValue);
      break;
    case 256:
      inputHandle.add256(bigIntValue);
      break;
    default:
      inputHandle.add128(bigIntValue); // Default to 128-bit for euint128
  }
  
  const result = await inputHandle.encrypt();
  
  console.log('✅ Encrypted input created successfully');
  console.log('🔍 Encrypted result structure:', result);
  
  // The FHEVM SDK returns an object with handles and inputProof
  // Following the voting contract pattern: pass handles[0] and inputProof directly
  // externalEuint128 is encoded as bytes32 in the ABI, so handles[0] should work directly
  
  if (result && typeof result === 'object') {
    // Extract handle and proof - pass them directly like the voting contract does
    // The voting contract test uses encrypted.handles[0] and encrypted.inputProof directly
    if (result.handles && Array.isArray(result.handles) && result.handles.length > 0 && result.inputProof) {
      let handle = result.handles[0];
      let proof = result.inputProof;
      
      console.log('📦 [FHEVM] Raw handle type:', typeof handle, handle instanceof Uint8Array ? 'Uint8Array' : Array.isArray(handle) ? 'Array' : 'other');
      console.log('📦 [FHEVM] Raw proof type:', typeof proof, proof instanceof Uint8Array ? 'Uint8Array' : Array.isArray(proof) ? 'Array' : 'other');
      
      // Convert to hex strings - ethers.js expects hex strings for bytes32 and bytes
      // Match the voting contract pattern exactly
      let handleHex: string;
      let proofHex: string;
      
      // Convert handle to hex string, ensuring exactly 32 bytes
      if (handle instanceof Uint8Array) {
        if (handle.length !== 32) {
          console.warn(`⚠️ Handle is ${handle.length} bytes, padding/truncating to 32 bytes`);
          const padded = new Uint8Array(32);
          padded.set(handle.slice(0, Math.min(32, handle.length)), 0);
          handleHex = ethers.hexlify(padded);
        } else {
          handleHex = ethers.hexlify(handle);
        }
      } else if (Array.isArray(handle)) {
        const arr = new Uint8Array(handle);
        if (arr.length !== 32) {
          const padded = new Uint8Array(32);
          padded.set(arr.slice(0, Math.min(32, arr.length)), 0);
          handleHex = ethers.hexlify(padded);
        } else {
          handleHex = ethers.hexlify(arr);
        }
      } else if (typeof handle === 'string') {
        if (!handle.startsWith('0x')) {
          handle = '0x' + handle;
        }
        const bytes = ethers.getBytes(handle);
        if (bytes.length !== 32) {
          const padded = new Uint8Array(32);
          padded.set(bytes.slice(0, Math.min(32, bytes.length)), 0);
          handleHex = ethers.hexlify(padded);
        } else {
          handleHex = handle;
        }
      } else {
        // Handle object format
        const keys = Object.keys(handle)
          .map(k => parseInt(k))
          .filter(k => !isNaN(k))
          .sort((a, b) => a - b);
        const values = keys.map(k => {
          const val = (handle as any)[k];
          return typeof val === 'number' ? val : parseInt(String(val), 10);
        });
        const arr = new Uint8Array(values);
        if (arr.length !== 32) {
          const padded = new Uint8Array(32);
          padded.set(arr.slice(0, Math.min(32, arr.length)), 0);
          handleHex = ethers.hexlify(padded);
        } else {
          handleHex = ethers.hexlify(arr);
        }
      }
      
      // Convert proof to hex string
      if (proof instanceof Uint8Array) {
        proofHex = ethers.hexlify(proof);
      } else if (Array.isArray(proof)) {
        proofHex = ethers.hexlify(new Uint8Array(proof));
      } else if (typeof proof === 'string') {
        if (!proof.startsWith('0x')) {
          proofHex = '0x' + proof;
        } else {
          proofHex = proof;
        }
      } else {
        // Handle object format
        const keys = Object.keys(proof)
          .map(k => parseInt(k))
          .filter(k => !isNaN(k))
          .sort((a, b) => a - b);
        const values = keys.map(k => {
          const val = (proof as any)[k];
          return typeof val === 'number' ? val : parseInt(String(val), 10);
        });
        proofHex = ethers.hexlify(new Uint8Array(values));
      }
      
      // Final verification
      const handleBytes = ethers.getBytes(handleHex);
      const proofBytes = ethers.getBytes(proofHex);
      
      console.log('📦 [FHEVM] Final handle (bytes32 hex):', handleHex);
      console.log(`   Handle length: ${handleBytes.length} bytes (must be 32)`);
      console.log('📦 [FHEVM] Final proof (bytes hex):', proofHex.substring(0, 50) + '...');
      console.log(`   Proof length: ${proofBytes.length} bytes`);
      
      if (handleBytes.length !== 32) {
        throw new Error(`Handle must be exactly 32 bytes, got ${handleBytes.length} bytes`);
      }
      
      // Return as hex strings - this matches what ethers.js expects for bytes32 and bytes
      return {
        encryptedData: handleHex, // bytes32 as hex string (exactly 32 bytes)
        proof: proofHex // bytes as hex string (variable length)
      };
    }
    // Fallback for other formats
    else if (result.encryptedData && result.proof) {
      console.log('📦 [FHEVM] Using encryptedData and proof (fallback format)');
      return {
        encryptedData: result.encryptedData,
        proof: result.proof
      };
    } else {
      throw new Error('Invalid encrypted result: missing handles/inputProof or encryptedData/proof');
    }
  }
  
  throw new Error('Invalid encrypted result format');
}

/**
 * Public decryption for a single handle
 * Returns the decrypted number value
 * @param {string} encryptedBytes - Single handle to decrypt
 * @returns {Promise<number>} Decrypted number value
 */
export async function publicDecrypt(encryptedBytes: string): Promise<number> {
  const fhe = getFheInstance();
  if (!fhe) throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');

  try {
    let handle = encryptedBytes;
    if (typeof handle === "string" && handle.startsWith("0x") && handle.length === 66) {
      console.log('🔓 Calling publicDecrypt with handle:', handle);
      const result = await fhe.publicDecrypt([handle]);
      console.log('🔓 publicDecrypt returned:', result);
      
      // SDK 0.3.0-5 returns: {clearValues: {...}, abiEncodedClearValues: '...', decryptionProof: '...'}
      let decryptedValue;
      
      if (result && typeof result === 'object') {
        // Check for SDK 0.3.0-5 format with clearValues
        if (result.clearValues && typeof result.clearValues === 'object') {
          // The decrypted value is in clearValues[handle] as a BigInt
          decryptedValue = result.clearValues[handle];
          console.log('🔓 Extracted from clearValues:', decryptedValue);
          console.log('🔓 Value type:', typeof decryptedValue);
          console.log('🔓 Is BigInt?', typeof decryptedValue === 'bigint');
        } else if (Array.isArray(result)) {
          // Legacy array format
          decryptedValue = result[0];
          console.log('🔓 Extracted from array:', decryptedValue);
        } else {
          // Try direct handle lookup (legacy format)
          decryptedValue = result[handle] || Object.values(result)[0];
          console.log('🔓 Extracted from object:', decryptedValue);
        }
      } else {
        // Direct value
        decryptedValue = result;
        console.log('🔓 Direct value:', decryptedValue);
      }
      
      // Convert BigInt or number to regular number
      let numberValue;
      if (typeof decryptedValue === 'bigint') {
        numberValue = Number(decryptedValue);
        console.log('🔓 Converted BigInt to number:', numberValue);
      } else {
        numberValue = Number(decryptedValue);
        console.log('🔓 Converted to number:', numberValue);
      }
      
      if (isNaN(numberValue)) {
        console.error('❌ Decryption returned NaN. Raw value:', decryptedValue);
        console.error('❌ Full response structure:', {
          hasClearValues: !!result?.clearValues,
          hasAbiEncoded: !!result?.abiEncodedClearValues,
          hasProof: !!result?.decryptionProof,
          clearValuesKeys: result?.clearValues ? Object.keys(result.clearValues) : []
        });
        throw new Error(`Decryption returned invalid value: ${decryptedValue}`);
      }
      
      console.log('🔓 Final number value:', numberValue);
      return numberValue;
    } else {
      throw new Error('Invalid ciphertext handle for decryption');
    }
  } catch (error: any) {
    console.error('❌ Decryption error:', error);
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
      throw new Error('Decryption service is temporarily unavailable. Please try again later.');
    }
    throw error;
  }
}

/**
 * Request user decryption with EIP-712 signature
 */
export async function requestUserDecryption(
  contractAddress: string,
  signer: any,
  ciphertextHandle: string
): Promise<number> {
  const relayer = getFheInstance();
  if (!relayer) throw new Error("FHEVM not initialized");

  const keypair = relayer.generateKeypair();
  const handleContractPairs = [
    {
      handle: ciphertextHandle,
      contractAddress: contractAddress,
    },
  ];

  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = "10";
  const contractAddresses = [contractAddress];

  const eip712 = relayer.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
  const signature = await signer.signTypedData(eip712.domain, {
    UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
  }, eip712.message);

  const result = await relayer.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    contractAddresses,
    await signer.getAddress(),
    startTimeStamp,
    durationDays
  );
  
  return Number(result[ciphertextHandle]);
}

/**
 * Public decryption for multiple handles with proof (for contract callbacks)
 * Returns cleartexts (ABI-encoded), decryption proof, and values array
 * Note: Handles must be made publicly decryptable (via makePubliclyDecryptable) before calling this
 * @param {string} contractAddress - The contract address (kept for compatibility, not used)
 * @param {Object} signer - Ethers signer object (kept for compatibility, not used)
 * @param {string[]} handles - Array of handles to decrypt
 * @returns {Object} { cleartexts: string, decryptionProof: string, values: number[] }
 */
export async function decryptMultipleHandles(
  contractAddress: string,
  signer: any,
  handles: string[]
): Promise<{ cleartexts: string; decryptionProof: string; values: number[] }> {
  const relayer = getFheInstance();
  if (!relayer) throw new Error("FHEVM not initialized");

  if (!handles || handles.length === 0) {
    throw new Error("Handles array cannot be empty");
  }

  // Use publicDecrypt for multiple handles (requires handles to be publicly decryptable)
  // This is called after requestTallyReveal() makes handles publicly decryptable
  console.log('🔐 Calling publicDecrypt with handles:', handles);
  const result = await relayer.publicDecrypt(handles);

  console.log('🔐 publicDecrypt result structure:', {
    hasClearValues: !!result?.clearValues,
    hasAbiEncoded: !!result?.abiEncodedClearValues,
    hasProof: !!result?.decryptionProof,
    clearValuesKeys: result?.clearValues ? Object.keys(result.clearValues) : [],
    resultKeys: Object.keys(result || {})
  });

  // Extract decrypted values in order
  // publicDecrypt returns: { clearValues: { handle1: value1, handle2: value2 }, abiEncodedClearValues: '...', decryptionProof: '...' }
  const values = handles.map(handle => {
    let decrypted;

    // Check for SDK 0.3.0-5 format with clearValues (BigInt values)
    if (result?.clearValues && typeof result.clearValues === 'object') {
      decrypted = result.clearValues[handle];
      console.log(`🔐 Extracted ${handle} from clearValues:`, decrypted, 'Type:', typeof decrypted);
    } else if (result && typeof result === 'object') {
      // Try direct handle lookup (legacy format)
      decrypted = result[handle];
      console.log(`🔐 Extracted ${handle} from result:`, decrypted);
    } else {
      throw new Error(`Failed to decrypt handle: ${handle} - result format not recognized`);
    }

    if (decrypted === undefined || decrypted === null) {
      throw new Error(`Failed to decrypt handle: ${handle} - value not found`);
    }

    // Convert BigInt or number to regular number
    let numberValue: number;
    if (typeof decrypted === 'bigint') {
      numberValue = Number(decrypted);
      console.log(`🔐 Converted BigInt to number for ${handle}:`, numberValue);
    } else {
      numberValue = Number(decrypted);
    }

    if (isNaN(numberValue)) {
      throw new Error(`Decryption returned invalid value for handle ${handle}: ${decrypted}`);
    }

    return numberValue;
  });

  // Get the proof and encoded values
  const abiEncodedClearValues = result?.abiEncodedClearValues;
  const decryptionProof = result?.decryptionProof;

  console.log('🔐 Proof check:', {
    hasAbiEncoded: !!abiEncodedClearValues,
    hasProof: !!decryptionProof,
    proofType: typeof decryptionProof
  });

  if (!decryptionProof) {
    console.error('❌ Decryption proof not found. Full result:', result);
    throw new Error("Decryption proof not found in result. Result structure: " + JSON.stringify(Object.keys(result || {})));
  }

  // If abiEncodedClearValues is not provided, encode it ourselves
  let cleartexts: string;
  if (abiEncodedClearValues) {
    cleartexts = abiEncodedClearValues;
    console.log('🔐 Using abiEncodedClearValues from result');
  } else {
    // Encode as tuple (uint32, uint32, ...) for multiple values
    const { ethers } = await import('ethers');
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const types = handles.map(() => 'uint32');
    cleartexts = abiCoder.encode(types, values);
    console.log('🔐 Encoded cleartexts manually:', cleartexts);
  }

  console.log('🔐 Final values:', values);
  console.log('🔐 Cleartexts length:', cleartexts?.length);
  console.log('🔐 Proof length:', decryptionProof?.length);

  return {
    cleartexts,
    decryptionProof,
    values
  };
}

/**
 * Public decryption for multiple handles (raw result)
 * Returns the raw result from relayer.publicDecrypt()
 * @param {string[]} handles - Array of handles to decrypt
 * @returns {Promise<Object>} Raw result with clearValues, abiEncodedClearValues, decryptionProof
 */
export async function fetchPublicDecryption(handles: string[]): Promise<any> {
  const relayer = getFheInstance();
  if (!relayer) throw new Error("FHEVM not initialized");
  return relayer.publicDecrypt(handles);
}
