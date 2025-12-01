
export interface Vault {
    id: string | number; // Can be string (from blockchain) or number (legacy)
    ownerAddress: string;
    encryptedData: string; // Encrypted mnemonic or file data (Base64) or IPFS CID
    vaultType: 'text' | 'file'; // Distinguish between content types
    fileName?: string; // Original filename if type is file
    mimeType?: string; // Mime type for file reconstruction
    heirKeyHash?: string; // Deprecated - access is now controlled by blockchain addresses via grantAccess
    releaseTime: number; // Unix timestamp
    createdAt: number;
    description?: string;
    isReleased: boolean;
    // Blockchain data
    cid?: string; // IPFS CID from blockchain
    // DEMO ONLY FIELDS FOR BACKUP DOWNLOAD
    _demo_ownerPassword?: string;
    _demo_heirKey?: string;
}

export type VaultStatus = 'active' | 'released' | 'locked';

export interface WalletState {
    address: string | null;
    isConnected: boolean;
    chainId: number | null;
}