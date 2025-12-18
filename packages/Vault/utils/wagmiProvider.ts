/**
 * Wagmi-based Ethereum provider utilities
 * Uses wagmi hooks to get the connected wallet provider (works with any wallet including Porto)
 */

import { useWalletClient, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';

/**
 * Get the ethers provider from wagmi's wallet client
 * This works with any connected wallet (Porto, MetaMask, etc.)
 */
export function useEthersProvider() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  if (!walletClient && !publicClient) {
    return null;
  }
  
  // Use walletClient if available (for signing), otherwise use publicClient (read-only)
  const client = walletClient || publicClient;
  
  if (!client) {
    return null;
  }
  
  // Convert viem client to ethers provider
  return new ethers.BrowserProvider(client as any);
}

/**
 * Get the ethers signer from wagmi's wallet client
 * This works with any connected wallet (Porto, MetaMask, etc.)
 */
export async function useEthersSigner() {
  const { data: walletClient } = useWalletClient();
  
  if (!walletClient) {
    return null;
  }
  
  const provider = new ethers.BrowserProvider(walletClient as any);
  return await provider.getSigner();
}

/**
 * Get provider and signer from wagmi (non-hook version for use outside components)
 * This should be called from within a component that has wagmi context
 */
export function getWagmiProvider(walletClient: any, publicClient: any) {
  const client = walletClient || publicClient;
  if (!client) {
    return null;
  }
  return new ethers.BrowserProvider(client as any);
}

export async function getWagmiSigner(walletClient: any) {
  if (!walletClient) {
    return null;
  }
  const provider = new ethers.BrowserProvider(walletClient as any);
  return await provider.getSigner();
}


