/**
 * Vault Contract Service
 * Handles interactions with the FHELegacyVault smart contract
 */

import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';

// Contract ABI - will be generated after compilation
// For now, using the interface from the contract
export const VAULT_ABI = [
    'function createVault(string calldata _vaultId, string calldata _cid, bytes32 _encryptedKey, bytes calldata _inputProof, uint256 _releaseTimestamp) external',
    'function grantAccess(string calldata _vaultId, address _heir) external',
    'function grantAccessToMultiple(string calldata _vaultId, address[] calldata _heirs) external',
    'function revokeAccess(string calldata _vaultId, address _heir) external',
    'function getEncryptedKey(string calldata _vaultId) external view returns (bytes32)',
    'function getEncryptedKeyAsOwner(string calldata _vaultId) external view returns (bytes32)',
    'function extendReleaseTime(string calldata _vaultId, uint256 _newTimestamp) external',
    'function getVaultMetadata(string calldata _vaultId) external view returns (address owner, string memory cid, uint256 releaseTimestamp, uint256 createdAt)',
    'function getUserVaults(address _user) external view returns (string[] memory)',
    'function getHeirVaults(address _heir) external view returns (string[] memory)',
    'function isAuthorized(string calldata _vaultId, address _address) external view returns (bool)',
    'function vaultExists(string calldata _vaultId) external view returns (bool)',
    'event VaultCreated(string indexed vaultId, address indexed owner, string cid, uint256 releaseTimestamp)',
    'event AccessGranted(string indexed vaultId, address indexed heir)',
    'event AccessRevoked(string indexed vaultId, address indexed heir)',
    'event ReleaseTimeExtended(string indexed vaultId, uint256 newTimestamp)',
] as const;

/**
 * Get contract instance
 */
export function getVaultContract(
    address: string,
    signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
    return new ethers.Contract(address, VAULT_ABI, signerOrProvider);
}

/**
 * Create a new vault
 */
export async function createVault(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    cid: string,
    encryptedKey: any, // externalEuint128
    proof: string,
    releaseTimestamp: number
): Promise<ethers.ContractTransactionResponse> {
    const contract = getVaultContract(contractAddress, signer);
    return await contract.createVault(vaultId, cid, encryptedKey, proof, releaseTimestamp);
}

/**
 * Grant access to a heir
 */
export async function grantAccess(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    heirAddress: string
): Promise<ethers.ContractTransactionResponse> {
    const contract = getVaultContract(contractAddress, signer);
    return await contract.grantAccess(vaultId, heirAddress);
}

/**
 * Grant access to multiple heirs at once
 */
export async function grantAccessToMultiple(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    heirAddresses: string[]
): Promise<ethers.ContractTransactionResponse> {
    const contract = getVaultContract(contractAddress, signer);
    return await contract.grantAccessToMultiple(vaultId, heirAddresses);
}

/**
 * Revoke access from a heir
 */
export async function revokeAccess(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    heirAddress: string
): Promise<ethers.ContractTransactionResponse> {
    const contract = getVaultContract(contractAddress, signer);
    return await contract.revokeAccess(vaultId, heirAddress);
}

/**
 * Get encrypted key (for heirs after release time)
 */
export async function getEncryptedKey(
    contractAddress: string,
    provider: ethers.Provider,
    vaultId: string
): Promise<any> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.getEncryptedKey(vaultId);
}

/**
 * Get encrypted key as owner (can access anytime)
 */
export async function getEncryptedKeyAsOwner(
    contractAddress: string,
    provider: ethers.Provider,
    vaultId: string
): Promise<any> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.getEncryptedKeyAsOwner(vaultId);
}

/**
 * Extend release time
 */
export async function extendReleaseTime(
    contractAddress: string,
    signer: ethers.Signer,
    vaultId: string,
    newTimestamp: number
): Promise<ethers.ContractTransactionResponse> {
    const contract = getVaultContract(contractAddress, signer);
    return await contract.extendReleaseTime(vaultId, newTimestamp);
}

/**
 * Get vault metadata
 */
export async function getVaultMetadata(
    contractAddress: string,
    provider: ethers.Provider,
    vaultId: string
): Promise<{
    owner: string;
    cid: string;
    releaseTimestamp: bigint;
    createdAt: bigint;
}> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.getVaultMetadata(vaultId);
}

/**
 * Get user's vaults
 */
export async function getUserVaults(
    contractAddress: string,
    provider: ethers.Provider,
    userAddress: string
): Promise<string[]> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.getUserVaults(userAddress);
}

/**
 * Get vaults where user is an authorized heir
 */
export async function getHeirVaults(
    contractAddress: string,
    provider: ethers.Provider,
    heirAddress: string
): Promise<string[]> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.getHeirVaults(heirAddress);
}

/**
 * Check if address is authorized
 */
export async function isAuthorized(
    contractAddress: string,
    provider: ethers.Provider,
    vaultId: string,
    address: string
): Promise<boolean> {
    const contract = getVaultContract(contractAddress, provider);
    return await contract.isAuthorized(vaultId, address);
}


