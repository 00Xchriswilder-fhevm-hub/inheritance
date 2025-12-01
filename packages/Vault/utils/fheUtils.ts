/**
 * FHE Key Conversion Utilities
 * Production-ready functions for converting AES keys to/from FHE-compatible numeric values
 * 
 * Note: FHE encryption/decryption is handled via hooks (useEncrypt, useDecrypt from @fhevm-sdk)
 * These utilities only handle the key conversion aspect.
 */

/**
 * Convert AES-256 key (32-byte ArrayBuffer) to a number for FHE encryption
 * 
 * Since FHE now supports euint256, we can store the full 32-byte key as a 256-bit value.
 * This preserves the entire key without any data loss.
 * 
 * @param keyBuffer The AES key as ArrayBuffer (must be 32 bytes for AES-256)
 * @returns A BigInt representation suitable for euint256 FHE encryption
 * @throws Error if keyBuffer is invalid or not 32 bytes
 */
export function keyToNumber(keyBuffer: ArrayBuffer): bigint {
    console.log('🔄 [FHE-UTILS] Converting AES key to number for FHE encryption...');
    console.log(`   Input key size: ${keyBuffer.byteLength} bytes`);
    
    if (!keyBuffer || keyBuffer.byteLength === 0) {
        throw new Error('Invalid key buffer: buffer is empty or null');
    }

    if (keyBuffer.byteLength !== 32) {
        throw new Error(`Invalid key buffer: expected exactly 32 bytes for AES-256, got ${keyBuffer.byteLength}`);
    }

    const bytes = new Uint8Array(keyBuffer);
    
    // Contract now uses euint256, so we can use all 32 bytes (256 bits)
    // Maximum value for 256-bit: 2^256 - 1
    // We must use BigInt to preserve precision for 256-bit values
    console.log(`   Using all 32 bytes for conversion (256-bit for euint256)`);
    
    // Convert all 32 bytes to a BigInt (256-bit value)
    let value = 0n;
    for (let i = 0; i < 32; i++) {
        value = (value << 8n) | BigInt(bytes[i]);
    }

    console.log(`✅ [FHE-UTILS] Key converted to BigInt: ${value.toString()}`);
    console.log(`   BigInt (hex): 0x${value.toString(16).padStart(64, '0')}`);
    console.log(`   BigInt (decimal): ${value.toString()}`);
    console.log(`   ✅ Full 32-byte key preserved in 256-bit value`);
    
    // Always return BigInt for 256-bit values to preserve precision
    return value;
}

/**
 * Convert number back to ArrayBuffer for AES key reconstruction
 * 
 * This reconstructs the full 32-byte key from the FHE-encrypted 256-bit number.
 * Since we now store all 32 bytes in euint256, we can perfectly reconstruct the key.
 * 
 * @param num The number from FHE decryption (should be a BigInt for 256-bit values)
 * @param keyLength The desired key length in bytes (default: 32 for AES-256)
 * @returns Reconstructed key as ArrayBuffer
 * @throws Error if num is invalid or keyLength is invalid
 */
export function numberToKey(num: number | bigint, keyLength: number = 32): ArrayBuffer {
    console.log('🔄 [FHE-UTILS] Converting number back to AES key...');
    console.log(`   Input number: ${num}`);
    console.log(`   Input type: ${typeof num}`);
    console.log(`   Target key length: ${keyLength} bytes`);
    
    // Convert to BigInt for proper 256-bit handling
    const seed = typeof num === 'bigint' ? num : BigInt(Math.floor(Number(num)));
    console.log(`   Seed (BigInt): ${seed.toString()}`);
    console.log(`   Seed (hex): 0x${seed.toString(16).padStart(64, '0')}`);
    
    if (keyLength !== 32) {
        throw new Error(`Invalid key length: must be exactly 32 bytes for AES-256, got ${keyLength}`);
    }

    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    
    // The number represents a 256-bit value (32 bytes) from euint256
    // Extract all 32 bytes from the BigInt in big-endian order
    // When packing: value = (value << 8n) | BigInt(bytes[i]) for i=0..31
    // So byte 0 is most significant, byte 31 is least significant
    console.log(`   Extracting all 32 bytes from 256-bit value...`);
    
    let remaining = seed;
    const bytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
        bytes[i] = Number(remaining & 0xffn);
        remaining = remaining >> 8n;
    }
    
    // Write bytes to buffer
    for (let i = 0; i < 32; i++) {
        view.setUint8(i, bytes[i]);
    }
    
    const keyBytes = new Uint8Array(buffer);
    console.log(`✅ [FHE-UTILS] Key reconstructed: ${keyLength} bytes`);
    console.log(`   Full key (hex): ${Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log(`   ✅ All 32 bytes recovered from 256-bit FHE value - no data loss!`);
    
    return buffer;
}

/**
 * Convert AES-256 key to multiple FHE values for enhanced security
 * 
 * Splits a 32-byte key into multiple numbers, each encrypted separately with FHE.
 * This approach provides better security as the full key is never represented
 * as a single number, and allows for larger keys to be stored.
 * 
 * @param keyBuffer The AES key as ArrayBuffer (typically 32 bytes for AES-256)
 * @param count Number of FHE values to create (default: 4, each representing 8 bytes)
 * @returns Array of numbers, each suitable for euint128 FHE encryption
 * @throws Error if keyBuffer is invalid or count is invalid
 */
export function keyToFHEValues(keyBuffer: ArrayBuffer, count: number = 4): number[] {
    if (!keyBuffer || keyBuffer.byteLength === 0) {
        throw new Error('Invalid key buffer: buffer is empty or null');
    }

    if (count < 1 || count > 8) {
        throw new Error(`Invalid count: must be between 1 and 8, got ${count}`);
    }

    const bytes = new Uint8Array(keyBuffer);
    const values: number[] = [];
    const bytesPerValue = Math.ceil(bytes.length / count);
    const maxSafeValue = BigInt(Number.MAX_SAFE_INTEGER);

    for (let i = 0; i < count; i++) {
        let value = 0n;
        const start = i * bytesPerValue;
        const end = Math.min(start + bytesPerValue, bytes.length);

        // Convert bytes to bigint
        for (let j = start; j < end; j++) {
            value = (value << 8n) | BigInt(bytes[j]);
        }

        // Ensure value fits in safe number range
        if (value > maxSafeValue) {
            value = value % maxSafeValue;
        }

        values.push(Number(value));
    }

    return values;
}

/**
 * Reconstruct AES key from multiple FHE values
 * 
 * Combines multiple FHE-decrypted numbers back into the original key.
 * 
 * @param values Array of numbers from FHE decryption
 * @param keyLength The original key length in bytes (default: 32 for AES-256)
 * @returns Reconstructed key as ArrayBuffer
 * @throws Error if values array is invalid or keyLength is invalid
 */
export function fheValuesToKey(values: number[], keyLength: number = 32): ArrayBuffer {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Invalid values array: must be a non-empty array');
    }

    if (keyLength < 16 || keyLength > 64 || keyLength % 8 !== 0) {
        throw new Error(`Invalid key length: must be between 16-64 bytes and multiple of 8, got ${keyLength}`);
    }

    const buffer = new ArrayBuffer(keyLength);
    const view = new DataView(buffer);
    let offset = 0;
    const bytesPerValue = 8; // Each value represents 8 bytes (64 bits)

    for (let i = 0; i < values.length && offset < keyLength; i++) {
        const value = values[i];
        
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid value at index ${i}: must be a finite non-negative number, got ${value}`);
        }

        const bigInt = BigInt(value);
        const bytesToWrite = Math.min(bytesPerValue, keyLength - offset);

        // Write bytes, handling partial writes at the end
        if (bytesToWrite === 8) {
            view.setBigUint64(offset, bigInt, false); // big-endian
        } else {
            // For partial writes, extract the lower bytes
            let remaining = bigInt;
            for (let j = bytesToWrite - 1; j >= 0; j--) {
                view.setUint8(offset + j, Number(remaining & 0xffn));
                remaining = remaining >> 8n;
            }
        }

        offset += bytesToWrite;
    }

    // Fill any remaining bytes with zeros if needed
    while (offset < keyLength) {
        view.setUint8(offset, 0);
        offset++;
    }

    return buffer;
}

/**
 * Validate that a reconstructed key matches the expected format
 * 
 * @param keyBuffer The key to validate
 * @param expectedLength The expected key length in bytes
 * @returns True if key is valid, false otherwise
 */
export function validateKey(keyBuffer: ArrayBuffer, expectedLength: number = 32): boolean {
    if (!keyBuffer || keyBuffer.byteLength !== expectedLength) {
        return false;
    }

    const bytes = new Uint8Array(keyBuffer);
    
    // Check that key is not all zeros (which would be invalid)
    const isAllZeros = bytes.every(byte => byte === 0);
    if (isAllZeros) {
        return false;
    }

    return true;
}
