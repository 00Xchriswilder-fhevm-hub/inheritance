/**
 * Hook for FHE Vault operations
 * Uses FHEVM SDK hooks (useEncrypt, useDecrypt) and wagmi
 */

import { useEncrypt, useDecrypt } from '@fhevm-sdk';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';

export function useFheVault() {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    
    // Use FHEVM SDK hooks
    const { encrypt, isEncrypting, error: encryptError } = useEncrypt();
    const { decrypt, isDecrypting, error: decryptError } = useDecrypt();

    /**
     * Encrypt a value using FHEVM
     * @param contractAddress The FHE contract address
     * @param value The numeric value to encrypt (number or bigint for large values)
     * @param bitSize The bit size for encryption (default: 256 for euint256 to store full 32-byte AES keys)
     * @returns Encrypted value with proof
     */
    const encryptValue = async (
        contractAddress: string,
        value: number | bigint,
        bitSize: 8 | 16 | 32 | 64 | 128 | 256 = 256
    ): Promise<{ encryptedData: any; proof: string }> => {
        if (!address) {
            throw new Error('Wallet not connected');
        }
        
        return await encrypt(contractAddress, address, value, bitSize);
    };

    /**
     * Decrypt an FHE-encrypted value
     * @param handle The encrypted value handle (bytes32)
     * @param contractAddress The FHE contract address
     * @returns Decrypted numeric value (number or bigint for 256-bit values)
     */
    const decryptValue = async (
        handle: string,
        contractAddress: string
    ): Promise<number | bigint> => {
        if (!walletClient || !address) {
            throw new Error('Wallet not connected');
        }

        // Convert viem WalletClient to ethers Signer
        const provider = new ethers.BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        
        return await decrypt(handle, contractAddress, signer);
    };

    /**
     * Get ethers signer from wagmi wallet client
     */
    const getSigner = async (): Promise<ethers.Signer | null> => {
        if (!walletClient) return null;
        
        const provider = new ethers.BrowserProvider(walletClient as any);
        return await provider.getSigner();
    };

    return {
        encryptValue,
        decryptValue,
        getSigner,
        isEncrypting,
        isDecrypting,
        encryptError,
        decryptError,
        isConnected,
        address,
    };
}

