/**
 * AES-256-GCM Encryption Utilities
 * Provides client-side encryption for vault data before IPFS storage
 */

/**
 * Generate a cryptographically secure random key for AES-256
 */
export async function generateAESKey(): Promise<CryptoKey> {
    console.log('🔑 [AES] Generating AES-256-GCM key...');
    const key = await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
    console.log('✅ [AES] AES key generated successfully');
    return key;
}

/**
 * Generate a random IV (Initialization Vector) for AES-GCM
 */
export function generateIV(): Uint8Array {
    console.log('🔐 [AES] Generating 12-byte IV for GCM...');
    const iv = new Uint8Array(12); // 12 bytes for GCM
    crypto.getRandomValues(iv);
    console.log('✅ [AES] IV generated:', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''));
    return iv;
}

/**
 * Encrypt data using AES-256-GCM
 * @param data The data to encrypt (string or ArrayBuffer)
 * @param key The AES key
 * @returns Object containing encrypted data, IV, and tag
 */
export async function encryptAES(
    data: string | ArrayBuffer,
    key: CryptoKey
): Promise<{
    encrypted: ArrayBuffer;
    iv: Uint8Array;
    tag: ArrayBuffer;
}> {
    const dataSize = typeof data === 'string' ? data.length : data.byteLength;
    console.log(`🔒 [AES] Starting encryption - Data size: ${dataSize} ${typeof data === 'string' ? 'chars' : 'bytes'}`);
    
    const iv = generateIV();
    
    // Convert string to ArrayBuffer if needed
    const dataBuffer = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

    console.log(`🔒 [AES] Encrypting ${dataBuffer.byteLength} bytes with AES-256-GCM...`);
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv.buffer as ArrayBuffer,
            tagLength: 128, // 128-bit authentication tag
        },
        key,
        dataBuffer
    );

    // Extract tag from encrypted data (last 16 bytes)
    const tag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(0, -16);

    console.log(`✅ [AES] Encryption complete:`);
    console.log(`   - Ciphertext size: ${ciphertext.byteLength} bytes`);
    console.log(`   - Tag size: ${tag.byteLength} bytes`);
    console.log(`   - Total encrypted size: ${encrypted.byteLength} bytes`);

    return {
        encrypted: ciphertext,
        iv: iv,
        tag: tag,
    };
}

/**
 * Decrypt data using AES-256-GCM
 * @param encrypted Encrypted data
 * @param key The AES key
 * @param iv The initialization vector
 * @param tag The authentication tag
 * @returns Decrypted data as ArrayBuffer
 */
export async function decryptAES(
    encrypted: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array,
    tag: ArrayBuffer
): Promise<ArrayBuffer> {
    console.log('🔓 [AES] Starting decryption...');
    console.log(`   Encrypted data size: ${encrypted.byteLength} bytes`);
    console.log(`   IV size: ${iv.byteLength} bytes`);
    console.log(`   Tag size: ${tag.byteLength} bytes`);
    
    // Combine ciphertext and tag for GCM decryption
    const combined = new Uint8Array(encrypted.byteLength + tag.byteLength);
    combined.set(new Uint8Array(encrypted), 0);
    combined.set(new Uint8Array(tag), encrypted.byteLength);

    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv.buffer as ArrayBuffer,
                tagLength: 128,
            },
            key,
            combined.buffer as ArrayBuffer
        );
        console.log('✅ [AES] Decryption successful');
        return decrypted;
    } catch (error: any) {
        console.error('❌ [AES] Decryption failed:', error);
        console.error('   Error name:', error?.name);
        console.error('   Error message:', error?.message);
        
        // Provide more helpful error message
        if (error?.name === 'OperationError') {
            throw new Error(
                'AES decryption failed. This usually means the encryption key is incorrect. ' +
                'If this is an FHE vault, the key reconstruction may have failed because only 16 bytes of the 32-byte key were stored in FHE. ' +
                'The remaining 16 bytes were lost and cannot be recovered. ' +
                'Original error: ' + (error?.message || 'OperationError')
            );
        }
        throw error;
    }
}

/**
 * Convert CryptoKey to raw bytes (for storage/transmission)
 * @param key The CryptoKey to export
 * @returns Raw key bytes
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
}

/**
 * Import raw key bytes back to CryptoKey
 * @param keyData Raw key bytes
 * @returns CryptoKey
 */
export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        keyData,
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Encrypt and package data for IPFS storage
 * Returns a JSON string containing encrypted data, IV, and tag
 */
export async function encryptForIPFS(
    data: string | ArrayBuffer,
    key: CryptoKey
): Promise<string> {
    console.log('📦 [AES->IPFS] Packaging encrypted data for IPFS...');
    const { encrypted, iv, tag } = await encryptAES(data, key);
    
    const encryptedBase64 = arrayBufferToBase64(encrypted);
    const ivBase64 = arrayBufferToBase64(new Uint8Array(iv).buffer);
    const tagBase64 = arrayBufferToBase64(tag);
    
    const packaged = JSON.stringify({
        encrypted: encryptedBase64,
        iv: ivBase64,
        tag: tagBase64,
    });
    
    console.log(`✅ [AES->IPFS] Data packaged for IPFS:`);
    console.log(`   - Encrypted data (base64): ${encryptedBase64.substring(0, 50)}... (${encryptedBase64.length} chars)`);
    console.log(`   - IV (base64): ${ivBase64} (${ivBase64.length} chars)`);
    console.log(`   - Tag (base64): ${tagBase64.substring(0, 30)}... (${tagBase64.length} chars)`);
    console.log(`   - Total packaged size: ${packaged.length} bytes`);
    
    return packaged;
}

/**
 * Decrypt data from IPFS storage format
 */
export async function decryptFromIPFS(
    encryptedData: string,
    key: CryptoKey
): Promise<ArrayBuffer> {
    const parsed = JSON.parse(encryptedData);
    const encrypted = base64ToArrayBuffer(parsed.encrypted);
    const ivBuffer = base64ToArrayBuffer(parsed.iv);
    const tag = base64ToArrayBuffer(parsed.tag);
    const iv = new Uint8Array(ivBuffer);
    
    return await decryptAES(encrypted, key, iv, tag);
}

/**
 * Derive key from password using PBKDF2
 * @param password The password string
 * @param salt Random salt (optional, will generate if not provided)
 * @param iterations Number of iterations (default: 100000)
 * @returns Object containing key and salt
 */
export async function deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array,
    iterations: number = 100000
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    const passwordBuffer = new TextEncoder().encode(password);
    let saltBuffer: Uint8Array;
    if (salt) {
        saltBuffer = salt;
    } else {
        saltBuffer = new Uint8Array(16);
        crypto.getRandomValues(saltBuffer);
    }
    
    const baseKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer.buffer as ArrayBuffer,
            iterations: iterations,
            hash: 'SHA-256',
        },
        baseKey,
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    );
    
    return { key, salt: saltBuffer };
}

