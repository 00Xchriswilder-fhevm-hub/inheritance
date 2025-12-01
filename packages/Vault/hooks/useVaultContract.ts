/**
 * Hook for FHE Vault Contract interactions
 * Uses wagmi and FHEVM SDK hooks
 */

import { useMemo } from 'react';
import { useContract as useFhevmContract } from '@fhevm-sdk';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { VAULT_ABI } from '../services/vaultContractService';

export function useVaultContract(contractAddress?: string) {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    
    // Memoize the ABI array to prevent infinite re-renders
    // The useContract hook has abi in its dependency array, so we need a stable reference
    const memoizedABI = useMemo(() => [...VAULT_ABI] as any[], []);
    
    // Use FHEVM SDK's useContract hook for read operations
    const { contract: readContract, isReady, error } = useFhevmContract(
        contractAddress || '',
        memoizedABI
    );

    // Get signer for write operations
    const getSigner = async (): Promise<ethers.Signer | null> => {
        if (!walletClient || !address) return null;
        
        // Convert viem WalletClient to ethers Signer
        const provider = new ethers.BrowserProvider(walletClient as any);
        return await provider.getSigner();
    };

    // Get contract instance with signer for write operations
    const getWriteContract = async (): Promise<ethers.Contract | null> => {
        const signer = await getSigner();
        if (!signer || !contractAddress) return null;
        
        return new ethers.Contract(contractAddress, VAULT_ABI, signer);
    };

    return {
        readContract,
        getWriteContract,
        getSigner,
        isReady: isReady && isConnected,
        isConnected,
        address,
        error,
    };
}


