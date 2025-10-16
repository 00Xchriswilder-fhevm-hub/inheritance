/**
 * FHEVM Encryption - Universal SDK
 * Simple encryption using your working implementation
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

import { getFheInstance } from './fhevm.js';

/**
 * Encrypt values using FHEVM
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
 */
export async function createEncryptedInput(contractAddress: string, userAddress: string, value: number) {
  const fhe = getFheInstance();
  if (!fhe) throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');

  console.log(`🔐 Creating encrypted input for contract ${contractAddress}, user ${userAddress}, value ${value}`);
  
  const inputHandle = fhe.createEncryptedInput(contractAddress, userAddress);
  inputHandle.add32(value);
  const result = await inputHandle.encrypt();
  
  console.log('✅ Encrypted input created successfully');
  console.log('🔍 Encrypted result structure:', result);
  
  // The FHEVM SDK returns an object with handles and inputProof
  // We need to extract the correct values for the contract
  if (result && typeof result === 'object') {
    // If result has handles array, use the first handle
    if (result.handles && Array.isArray(result.handles) && result.handles.length > 0) {
      return {
        encryptedData: result.handles[0],
        proof: result.inputProof
      };
    }
    // If result has encryptedData and proof properties
    else if (result.encryptedData && result.proof) {
      return {
        encryptedData: result.encryptedData,
        proof: result.proof
      };
    }
    // Fallback: use the result as-is
    else {
      return {
        encryptedData: result,
        proof: result
      };
    }
  }
  
  // If result is not an object, use it directly
  return {
    encryptedData: result,
    proof: result
  };
}
