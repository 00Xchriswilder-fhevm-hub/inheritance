/**
 * Universal FHEVM SDK - Browser Only
 * FHEVM functionality for browser environments
 * Supports user decryption only (EIP-712 signed decryption)
 * Updated for FHEVM 0.9 with RelayerSDK 0.3.0-5
 */

import { ethers } from 'ethers';

let fheInstance: any = null;

/**
 * Initialize FHEVM instance
 * Browser-only implementation using CDN for RelayerSDK
 * Updated for RelayerSDK 0.3.0-5 (FHEVM 0.9)
 */
export async function initializeFheInstance() {
  // Only browser environment is supported (vault uses user decryption only)
  if (typeof window === 'undefined') {
    throw new Error('Browser environment required. This SDK only supports browser-based FHEVM operations.');
  }
  
  // Check for ethereum provider (mobile-friendly)
  const win = window as any;
  const hasEthereum = win.ethereum || 
                     win.web3?.currentProvider || 
                     win.web3 ||
                     win.ethereum?.providers?.[0] ||
                     win.ethereum?.providers?.find((p: any) => p.isMetaMask);
  
  if (!hasEthereum) {
    throw new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.');
  }
  
  return initializeBrowserFheInstance();
}

/**
 * Initialize FHEVM instance for browser environment
 * Enhanced for mobile browser compatibility
 */
async function initializeBrowserFheInstance() {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available. This code must run in a browser.');
  }

  // Enhanced mobile browser ethereum provider detection
  let ethereum = (window as any).ethereum;
  
  // Check for various ethereum provider patterns on mobile
  if (!ethereum) {
    const possibleProviders = [
      (window as any).ethereum,
      (window as any).web3?.currentProvider,
      (window as any).web3,
      (window as any).ethereum?.providers?.[0],
      (window as any).ethereum?.providers?.find((p: any) => p.isMetaMask),
      // Check for mobile wallet providers
      (window as any).trust,
      (window as any).coinbase,
      (window as any).phantom,
    ].filter(Boolean);
    
    if (possibleProviders.length > 0) {
      ethereum = possibleProviders[0];
  }
  }
  
  if (!ethereum) {
    // Wait up to 10 seconds for ethereum provider to load (mobile browsers may need time)
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const checkEthereum = () => {
        const foundProvider = (window as any).ethereum || 
                            (window as any).web3?.currentProvider || 
                            (window as any).web3 ||
                            (window as any).ethereum?.providers?.[0] ||
                            (window as any).ethereum?.providers?.find((p: any) => p.isMetaMask);
        
        if (foundProvider) {
          ethereum = foundProvider;
          resolve(undefined);
        } else if (attempts < 100) {
          attempts++;
          setTimeout(checkEthereum, 100);
        } else {
          if (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')) {
            reject(new Error('Mobile browser detected. Please ensure MetaMask is installed and the page is refreshed after connecting your wallet.'));
          } else {
            reject(new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.'));
          }
        }
      };
      checkEthereum();
    });
  }

  // Wait for RelayerSDK to be available (mobile browsers may need time)
  let sdk = (window as any).RelayerSDK || (window as any).relayerSDK;
  if (!sdk) {
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const checkSDK = () => {
        const foundSDK = (window as any).RelayerSDK || (window as any).relayerSDK;
        if (foundSDK) {
          sdk = foundSDK;
          resolve(undefined);
        } else if (attempts < 100) {
          attempts++;
          setTimeout(checkSDK, 100);
        } else {
          reject(new Error('RelayerSDK not loaded. Please include the script tag in your HTML:\n<script src="https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs"></script>'));
        }
      };
      checkSDK();
    });
  }

  const { initSDK, createInstance, SepoliaConfig } = sdk;

  // Initialize SDK with CDN
  await initSDK();
  
  const config = { ...SepoliaConfig, network: ethereum };
  
  try {
    fheInstance = await createInstance(config);
    return fheInstance;
  } catch (err) {
    console.error('FHEVM browser instance creation failed:', err);
    throw err;
  }
}


export function getFheInstance() {
  // If instance doesn't exist but we're in browser with ethereum, try to initialize
  if (!fheInstance && typeof window !== 'undefined') {
    const win = window as any;
    const hasEthereum = win.ethereum || 
                       win.web3?.currentProvider || 
                       win.web3 ||
                       win.ethereum?.providers?.[0] ||
                       win.ethereum?.providers?.find((p: any) => p.isMetaMask);
    
    if (hasEthereum) {
      // Instance should be initialized by the hook, but if it's not, log a warning
      console.warn('⚠️ FHE instance not initialized. Make sure to call initializeFheInstance() first.');
    }
  }
  return fheInstance;
}

/**
 * Decrypt a single encrypted value using EIP-712 user decryption (matches showcase API)
 */
export async function decryptValue(encryptedBytes: string, contractAddress: string, signer: any): Promise<number | bigint> {
  let fhe = getFheInstance();
  
  // Auto-initialize if not initialized but ethereum provider is available
  if (!fhe && typeof window !== 'undefined') {
    const win = window as any;
    const hasEthereum = win.ethereum || 
                       win.web3?.currentProvider || 
                       win.web3 ||
                       win.ethereum?.providers?.[0] ||
                       win.ethereum?.providers?.find((p: any) => p.isMetaMask);
    
    if (hasEthereum) {
      console.log('🔄 FHE instance not found, auto-initializing...');
      try {
        fhe = await initializeFheInstance();
      } catch (error) {
        console.error('❌ Auto-initialization failed:', error);
        throw new Error('FHE instance not initialized. Please wait for initialization to complete or refresh the page.');
      }
    }
  }
  
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

