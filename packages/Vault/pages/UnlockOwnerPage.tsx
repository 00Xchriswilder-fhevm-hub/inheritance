import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
// Material Symbols icons are used via className="material-symbols-outlined"
import type { Vault } from '../types';
// Material Symbols and custom styling used instead of component library
import { useToast } from '../contexts/ToastContext';
import { useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { useFheVault } from '../hooks/useFheVault';
import { unlockVault, extendVaultReleaseTime } from '../services/fheVaultService';
import { getVaultMetadata, grantAccess, grantAccessToMultiple, revokeAccess } from '../services/vaultContractService';
import { ethers } from 'ethers';
import { getTransactionErrorMessage } from '../utils/errorHandler';

const UnlockOwnerPage = () => {
    const [decryptedData, setDecryptedData] = useState<string | null>(null);
    const [decryptedFileBuffer, setDecryptedFileBuffer] = useState<ArrayBuffer | null>(null);
    const [currentVault, setCurrentVault] = useState<Vault | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hideMnemonic, setHideMnemonic] = useState(false);
    const [countdown, setCountdown] = useState<{days: string, hours: string, min: string, sec: string} | null>(null);
    
    // Scheduling State
    const [isEditingSchedule, setIsEditingSchedule] = useState(false);
    const [newReleaseDate, setNewReleaseDate] = useState('');
    const [newReleaseTime, setNewReleaseTime] = useState('');
    
    // Heir Management State
    const [authorizedHeirs, setAuthorizedHeirs] = useState<string[]>([]);
    const [isLoadingHeirs, setIsLoadingHeirs] = useState(false);
    const [isManagingHeirs, setIsManagingHeirs] = useState(false);
    const [newHeirAddress, setNewHeirAddress] = useState('');
    const [isGrantingAccess, setIsGrantingAccess] = useState(false);
    const [isRevokingAccess, setIsRevokingAccess] = useState<string | null>(null);

    const toast = useToast();
    const location = useLocation();
    const { register, handleSubmit, setValue, formState: { errors } } = useForm();
    const { isConnected, address } = useContext(WalletContext);
    const { decryptValue, getSigner } = useFheVault();

    // Auto-fill Vault ID and set vault data if passed from navigation state
    useEffect(() => {
        if (location.state) {
            if (location.state.vaultId) {
            setValue('vaultId', location.state.vaultId);
            }
            // If full vault object is passed, use it immediately (no need to fetch from blockchain)
            if (location.state.vault) {
                const vault = location.state.vault as Vault;
                setCurrentVault(vault);
                console.log('✅ Using vault data from navigation state:', vault);
            }
        }
    }, [location.state, setValue]);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            // Accept both string and number vault IDs
            const vaultId = data.vaultId.trim();
            
            // Fetch vault from blockchain only
                const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
            if (!CONTRACT_ADDRESS) {
                toast.error('Blockchain connection required. Please configure contract address.');
                setIsLoading(false);
                return;
            }
            
            // Mobile-friendly ethereum provider detection
            const { getEthereumProvider } = await import('../utils/ethereumProvider');
            const ethereum = getEthereumProvider();
            if (!ethereum) {
                toast.error('Blockchain connection required. Please connect your wallet.');
                setIsLoading(false);
                return;
            }

                    try {
                        const { getVaultMetadata } = await import('../services/vaultContractService');
                        const { getIPFSMetadata } = await import('../services/ipfsService');
                        const { getEthereumProvider } = await import('../utils/ethereumProvider');
                        const ethereumProvider = getEthereumProvider();
                        if (!ethereumProvider) {
                            throw new Error('Ethereum provider not found');
                        }
                        const provider = new (await import('ethers')).BrowserProvider(ethereumProvider);
                        const metadata = await getVaultMetadata(CONTRACT_ADDRESS, provider, vaultId);
                        
                        // Try to get IPFS metadata to determine vault type, filename, and mime type
                        let vaultType: 'text' | 'file' = 'text';
                        let fileName: string | undefined;
                        let mimeType: string | undefined;
                        
                        try {
                            const ipfsMetadata = await getIPFSMetadata(metadata.cid);
                            if (ipfsMetadata?.keyvalues) {
                                if (ipfsMetadata.keyvalues.type === 'file') {
                                    vaultType = 'file';
                                }
                                if (ipfsMetadata.keyvalues.fileName) {
                                    fileName = ipfsMetadata.keyvalues.fileName;
                                }
                                if (ipfsMetadata.keyvalues.mimeType) {
                                    mimeType = ipfsMetadata.keyvalues.mimeType;
                                }
                            }
                        } catch (error) {
                            console.warn('Could not fetch IPFS metadata, defaulting to text type:', error);
                        }
                        
                        // Create vault object from blockchain data
                const vault = {
                            id: vaultId,
                            ownerAddress: metadata.owner,
                            encryptedData: metadata.cid, // IPFS CID
                            cid: metadata.cid,
                            vaultType: vaultType,
                            fileName: fileName,
                            mimeType: mimeType,
                            heirKeyHash: '',
                            releaseTime: Number(metadata.releaseTimestamp) * 1000,
                            createdAt: Number(metadata.createdAt) * 1000,
                            isReleased: Date.now() >= Number(metadata.releaseTimestamp) * 1000,
                            description: `Vault ${vaultId}`,
                        };
                
                // Set the vault state
                setCurrentVault(vault);
                
                // Continue with vault processing below
                const currentVaultObj = vault;
                
                    } catch (error) {
                        console.error('Error fetching vault from blockchain:', error);
                toast.error("Vault not found or error fetching from blockchain. Please check the Vault ID.");
                setIsLoading(false);
                return;
            }
            
            // Get the vault from state (it was set above)
            const vault = currentVault;
            if (!vault) {
                toast.error("Vault not found. Please check the Vault ID.");
                setIsLoading(false);
                return;
            }
            
            // For blockchain vaults, we need to use FHE unlock service
            // Check if it's a blockchain vault (has CID or encryptedData looks like an IPFS CID)
            // IPFS CIDs typically start with 'Qm' (v0) or 'baf' (v1) or are base58/base32 encoded
            const looksLikeIPFSCID = (str: string) => {
                // IPFS CID v0: starts with Qm and is 46 chars
                // IPFS CID v1: starts with baf and is longer
                // Also check if it matches the pattern of a CID (alphanumeric, no ::: separator)
                return str.startsWith('Qm') || str.startsWith('baf') || 
                       (str.length > 40 && !str.includes(':::')) ||
                       /^[a-zA-Z0-9]{40,}$/.test(str);
            };
            
            const isBlockchainVault = vault.cid || 
                                      (vault.encryptedData && looksLikeIPFSCID(vault.encryptedData)) ||
                                      (vault.encryptedData && vault.encryptedData === vault.cid);
            
            if (isBlockchainVault) {
                // This is a blockchain vault - use FHE unlock
                if (!isConnected || !address) {
                    toast.error("Please connect your wallet to unlock FHE vaults");
                    setIsLoading(false);
                    return;
                }
                
                const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
                if (!CONTRACT_ADDRESS) {
                    toast.error("Contract address not configured");
                    setIsLoading(false);
                    return;
                }
                
                try {
                    toast.info("Unlocking FHE vault...");
                    const signer = await getSigner();
                    if (!signer) {
                        throw new Error("Failed to get signer");
                    }
                    
                    const { getEthereumProvider } = await import('../utils/ethereumProvider');
                    const ethereumProvider = getEthereumProvider();
                    if (!ethereumProvider) {
                        throw new Error('Ethereum provider not found');
                    }
                    const provider = signer.provider || new ethers.BrowserProvider(ethereumProvider);
                    
                    // Use FHE unlock service
                    const decrypted = await unlockVault({
                        vaultId: vaultId,
                        contractAddress: CONTRACT_ADDRESS,
                        provider: provider,
                        signer: signer,
                        userAddress: address,
                        decryptFn: (handle, contractAddr) => decryptValue(handle, contractAddr),
                        isOwner: true, // Owner can unlock anytime
                    });
                    
                    // Handle decrypted data based on vault type
                    // unlockVault now returns ArrayBuffer
                    if (vault.vaultType === 'file') {
                        // For files, store the ArrayBuffer for download
                        if (decrypted instanceof ArrayBuffer) {
                            setDecryptedFileBuffer(decrypted);
                            setDecryptedData(null); // Clear text data
                        } else {
                            // Fallback: if it's a string, try to convert (shouldn't happen)
                            console.warn('File vault returned string, converting to ArrayBuffer');
                            const buffer = new TextEncoder().encode(decrypted).buffer;
                            setDecryptedFileBuffer(buffer);
                            setDecryptedData(null);
                        }
                    } else {
                        // For text vaults, convert ArrayBuffer to string
                        if (decrypted instanceof ArrayBuffer) {
                            const decryptedText = new TextDecoder().decode(decrypted);
                            setDecryptedData(decryptedText);
                        } else {
                            setDecryptedData(decrypted);
                        }
                        setDecryptedFileBuffer(null); // Clear file buffer
                    }
                    
                    setCurrentVault(vault);
                    
                    // Init edit state values
                    const releaseDateObj = new Date(vault.releaseTime);
                    setNewReleaseDate(releaseDateObj.toISOString().split('T')[0]);
                    setNewReleaseTime(releaseDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

                    toast.success("FHE vault decrypted successfully");
                    setIsLoading(false);
                    return;
                } catch (error: any) {
                    console.error('Error unlocking FHE vault:', error);
                    toast.error(getTransactionErrorMessage(error));
                    setIsLoading(false);
                    return;
                }
            }
            
            // Local vaults are deprecated - all vaults should be on blockchain
            toast.error("This vault appears to be a local vault. Please use blockchain vaults with wallet authentication.");
            setIsLoading(false);
            return;
        } catch (error: any) {
            console.error('Error unlocking vault:', error);
            toast.error(getTransactionErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // Countdown Logic
    useEffect(() => {
        if (!currentVault) return;
        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = currentVault.releaseTime - now;
            if (distance < 0) {
                setCountdown({ days: '00', hours: '00', min: '00', sec: '00' });
                return;
            }
            const days = Math.floor(distance / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
            const min = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            const sec = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');
            setCountdown({ days, hours, min, sec });
        };
        const interval = setInterval(updateCountdown, 1000);
        updateCountdown();
        return () => clearInterval(interval);
    }, [currentVault]);

    // Helper function to fetch authorized heirs from on-chain data
    const fetchAuthorizedHeirs = useCallback(async () => {
        if (!currentVault || !address || !isConnected) return;
        
        const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
        const { getEthereumProvider } = await import('../utils/ethereumProvider');
        const ethereumProvider = getEthereumProvider();
        if (!CONTRACT_ADDRESS || !ethereumProvider) return;
        
        const looksLikeIPFSCID = (str: string) => {
            return str.startsWith('Qm') || str.startsWith('baf') || 
                   (str.length > 40 && !str.includes(':::')) ||
                   /^[a-zA-Z0-9]{40,}$/.test(str);
        };
        
        const isBlockchainVault = currentVault.cid || 
                                  (currentVault.encryptedData && looksLikeIPFSCID(currentVault.encryptedData));
        
        if (!isBlockchainVault) return;
        
        setIsLoadingHeirs(true);
        try {
            const provider = new ethers.BrowserProvider(ethereumProvider);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, [
                'event AccessGranted(string indexed vaultId, address indexed heir)',
                'event AccessRevoked(string indexed vaultId, address indexed heir)',
                'function authorizedHeirs(string, address) view returns (bool)',
            ], provider);
            
            // Query AccessGranted events for this vault
            const grantedFilter = contract.filters.AccessGranted(currentVault.id);
            const grantedEvents = await contract.queryFilter(grantedFilter);
            
            // Query AccessRevoked events for this vault
            const revokedFilter = contract.filters.AccessRevoked(currentVault.id);
            const revokedEvents = await contract.queryFilter(revokedFilter);
            
            // Build set of all addresses that were ever granted access
            const allHeirAddresses = new Set<string>();
            grantedEvents.forEach((event: any) => {
                if (event.args && event.args.heir) {
                    allHeirAddresses.add(event.args.heir.toLowerCase());
                }
            });
            
            // Check current authorization status directly from the mapping
            // This is the source of truth, not events
            const verifiedHeirs: string[] = [];
            for (const heirAddress of Array.from(allHeirAddresses)) {
                try {
                    // Query the authorizedHeirs mapping directly (this is the current state)
                    const isAuthorized = await contract.authorizedHeirs(currentVault.id, heirAddress);
                    if (isAuthorized) {
                        verifiedHeirs.push(heirAddress);
                    }
                } catch (error) {
                    console.error(`Error checking authorization for ${heirAddress}:`, error);
                }
            }
            
            setAuthorizedHeirs(verifiedHeirs);
        } catch (error) {
            console.error('Error fetching authorized heirs:', error);
        } finally {
            setIsLoadingHeirs(false);
        }
    }, [currentVault, address, isConnected]);

    // Fetch authorized heirs when vault is loaded
    useEffect(() => {
        fetchAuthorizedHeirs();
    }, [fetchAuthorizedHeirs]);

    const copyToClipboard = () => {
        if (decryptedData) {
            navigator.clipboard.writeText(decryptedData);
            toast.success("Copied to clipboard");
        }
    };

    const downloadFile = async () => {
        if (!currentVault) return;
        
        try {
            // For file vaults, use the ArrayBuffer
            if (currentVault.vaultType === 'file' && decryptedFileBuffer) {
                // Get file type from vault metadata or default to application/octet-stream
                const mimeType = currentVault.mimeType || 'application/octet-stream';
                
                // Create Blob from ArrayBuffer
                const blob = new Blob([decryptedFileBuffer], { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                // Create download link
                const link = document.createElement("a");
                link.href = url;
                link.download = currentVault.fileName || "vault-content";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up object URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                toast.success("File downloaded successfully");
            } else if (decryptedData && currentVault.vaultType !== 'file') {
                // For text vaults, create a text file
                const blob = new Blob([decryptedData], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = currentVault.fileName || "vault-content.txt";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 100);
                toast.success("File downloaded successfully");
            } else {
                toast.error("No file data available to download");
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error("Failed to download file");
        }
    };

    const downloadEncryptedBackup = async () => {
        if (!currentVault || !address) {
            toast.error("Vault or wallet address missing");
            return;
        }

        try {
            setIsLoading(true);
            toast.info("Preparing encrypted backup...");

            const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
            if (!CONTRACT_ADDRESS) {
                throw new Error("Contract address not configured");
            }

            // Get provider and signer
            const { getEthereumProvider } = await import('../utils/ethereumProvider');
            const ethereumProvider = getEthereumProvider();
            if (!ethereumProvider) {
                throw new Error("No ethereum provider found");
            }
            const provider = new ethers.BrowserProvider(ethereumProvider);
            const signer = await provider.getSigner();

            // Get vault metadata and encrypted key handle
            const { getVaultMetadata, VAULT_ABI } = await import('../services/vaultContractService');
            const metadata = await getVaultMetadata(CONTRACT_ADDRESS, provider, currentVault.id);
            
            // Use signer for getEncryptedKeyAsOwner (it checks msg.sender)
            const contract = new ethers.Contract(CONTRACT_ADDRESS, [...VAULT_ABI] as any[], signer);
            const encryptedKeyHandle = await contract.getEncryptedKeyAsOwner(currentVault.id);

            // Download encrypted data from IPFS
            const { downloadFromIPFSAsText } = await import('../services/ipfsService');
            const encryptedData = await downloadFromIPFSAsText(metadata.cid);

            // Create comprehensive backup file
            const backupContent = `
═══════════════════════════════════════════════════════════════════════════════
                    FHE VAULT - ENCRYPTED BACKUP FILE
═══════════════════════════════════════════════════════════════════════════════

⚠️  CRITICAL SECURITY WARNING ⚠️
───────────────────────────────────────────────────────────────────────────────
ALL DATA IN THIS FILE IS ENCRYPTED AND CANNOT BE DECRYPTED WITHOUT:
1. FHEVM Access Control List (ACL) authorization
2. The FHE-encrypted AES decryption key (256-bit) stored on-chain
3. Proper FHEVM decryption capabilities

WITHOUT FHEVM ACL ACCESS, THIS ENCRYPTED DATA CANNOT BE USED TO DECRYPT
THE VAULT CONTENTS. The FHE-encrypted AES key requires FHEVM's homomorphic
decryption capabilities and proper authorization to decrypt.

This backup is for archival purposes only. To decrypt, you must:
- Have FHEVM ACL access (owner or authorized heir)
- Use the FHEVM SDK with proper decryption permissions
- Access the contract's encrypted key through authorized methods

═══════════════════════════════════════════════════════════════════════════════
                            VAULT METADATA
═══════════════════════════════════════════════════════════════════════════════

Vault ID:              ${currentVault.id}
Owner Address:         ${currentVault.ownerAddress}
Created:               ${new Date(currentVault.createdAt).toLocaleString()}
Release Date:          ${new Date(currentVault.releaseTime).toLocaleString()}
Vault Type:            ${currentVault.vaultType || 'Unknown'}
Status:                ${Date.now() < currentVault.releaseTime ? 'LOCKED' : 'RELEASED'}
Contract Address:      ${CONTRACT_ADDRESS}
Network:               Sepolia Testnet

═══════════════════════════════════════════════════════════════════════════════
                        ENCRYPTED DATA (IPFS)
═══════════════════════════════════════════════════════════════════════════════

IPFS CID:              ${metadata.cid}
IPFS Gateway URL:      https://gateway.pinata.cloud/ipfs/${metadata.cid}

Encrypted Data (Base64):
───────────────────────────────────────────────────────────────────────────────
${encryptedData.substring(0, 2000)}${encryptedData.length > 2000 ? '\n... (truncated, full data in IPFS)' : ''}

Full encrypted data is stored on IPFS at the CID above.
This data is encrypted with AES-256-GCM and requires the decryption key
(which is FHE-encrypted on-chain) to decrypt.

═══════════════════════════════════════════════════════════════════════════════
              FHE-ENCRYPTED AES DECRYPTION KEY (ON-CHAIN)
═══════════════════════════════════════════════════════════════════════════════

Encrypted Key Handle:  ${encryptedKeyHandle}

⚠️  IMPORTANT: This is the FHE-encrypted AES decryption key (256-bit).
    It is stored on-chain in the FHELegacyVault contract.
    
    To decrypt this key, you need:
    - FHEVM Access Control List (ACL) authorization
    - The FHEVM SDK with proper decryption capabilities
    - Access through authorized contract methods:
      * getEncryptedKeyAsOwner() - for vault owner
      * getEncryptedKey() - for authorized heirs (after release time)
    
    Without FHEVM ACL access, this encrypted key handle cannot be decrypted,
    and therefore the IPFS data cannot be decrypted.

═══════════════════════════════════════════════════════════════════════════════
                            DECRYPTION PROCESS
═══════════════════════════════════════════════════════════════════════════════

To decrypt this vault:

1. Get the encrypted key handle from the contract (requires ACL access)
   - Owner: Use getEncryptedKeyAsOwner(vaultId)
   - Heir: Use getEncryptedKey(vaultId) after release time

2. Decrypt the FHE-encrypted key using FHEVM SDK
   - This requires FHEVM ACL authorization
   - Use decryptValue(encryptedKeyHandle, contractAddress, signer)

3. Convert the decrypted key number to AES key (32 bytes)
   - Use numberToKey() utility function

4. Download encrypted data from IPFS using the CID

5. Decrypt the IPFS data using AES-256-GCM with the decrypted key
   - Use decryptFromIPFS() utility function

═══════════════════════════════════════════════════════════════════════════════
                            SECURITY NOTES
═══════════════════════════════════════════════════════════════════════════════

- The encrypted data on IPFS is safe to share (it's encrypted)
- The encrypted key handle is safe to share (it's FHE-encrypted)
- However, without FHEVM ACL access, neither can be decrypted
- Keep this backup file secure, but understand it cannot be used
  to decrypt the vault without proper FHEVM authorization

- The vault owner can always decrypt (has ACL access)
- Authorized heirs can decrypt after the release timestamp
- Unauthorized parties cannot decrypt even with this backup

═══════════════════════════════════════════════════════════════════════════════
Generated: ${new Date().toLocaleString()}
LegacyVault App - FHE-Encrypted Vault System
═══════════════════════════════════════════════════════════════════════════════
`;

            // Create and download backup file
            const blob = new Blob([backupContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `FHE-Vault-Backup-${currentVault.id}-${Date.now()}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);

            toast.success("Encrypted backup downloaded successfully");
           } catch (error: any) {
               console.error('Error creating encrypted backup:', error);
               toast.error(getTransactionErrorMessage(error));
           } finally {
            setIsLoading(false);
        }
    };

    const clearData = () => {
        setDecryptedData(null);
        setDecryptedFileBuffer(null);
        setCurrentVault(null);
        setIsEditingSchedule(false);
        toast.success("Data cleared from screen");
    };

    const handleUpdateSchedule = async () => {
        if (!currentVault) return;
        
        const combined = new Date(`${newReleaseDate}T${newReleaseTime}`);
        if (isNaN(combined.getTime())) {
            toast.error("Invalid date or time");
            return;
        }

        // Check if this is a blockchain vault
        const looksLikeIPFSCID = (str: string) => {
            return str.startsWith('Qm') || str.startsWith('baf') || 
                   (str.length > 40 && !str.includes(':::')) ||
                   /^[a-zA-Z0-9]{40,}$/.test(str);
        };
        
        const isBlockchainVault = currentVault.cid || 
                                  (currentVault.encryptedData && looksLikeIPFSCID(currentVault.encryptedData));

        if (isBlockchainVault) {
            // This is a blockchain vault - update on-chain
            if (!isConnected || !address) {
                toast.error("Please connect your wallet to update the release time");
                return;
            }
            
            const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
            if (!CONTRACT_ADDRESS) {
                toast.error("Contract address not configured");
                return;
            }

            try {
                setIsLoading(true);
                toast.info("Validating release time...");
                
                const signer = await getSigner();
                if (!signer) {
                    throw new Error("Failed to get signer");
                }

                const { getEthereumProvider } = await import('../utils/ethereumProvider');
                const ethereumProvider = getEthereumProvider();
                if (!ethereumProvider) {
                    throw new Error('Ethereum provider not found');
                }
                const provider = signer.provider || new ethers.BrowserProvider(ethereumProvider);
                
                const newTimestamp = Math.floor(combined.getTime() / 1000);
                
                // Owner has full liberty - no restrictions on timestamp value
                // They can extend, shorten, or even set to past to release immediately
                toast.info("Updating release time on blockchain...");
                
                // Call contract to extend release time
                const tx = await extendVaultReleaseTime(
                    CONTRACT_ADDRESS,
                    signer,
                    currentVault.id,
                    newTimestamp
                );
                
                toast.info("Waiting for transaction confirmation...");
                const receipt = await tx.wait();
                
                // Update local state (blockchain is source of truth)
                const updatedVault = { ...currentVault, releaseTime: combined.getTime() };
                setCurrentVault(updatedVault);
                setIsEditingSchedule(false);
                
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-bold">Release time updated on blockchain!</span>
                        <span className="text-xs">Transaction: {receipt.hash.substring(0, 10)}...</span>
                    </div>
                );
               } catch (error: any) {
                   console.error('Error updating release time:', error);
                   toast.error(getTransactionErrorMessage(error));
               } finally {
                setIsLoading(false);
            }
        } else {
            // This should not happen - all vaults are on blockchain
            toast.error("Vault not found on blockchain. Please check the Vault ID.");
            setIsEditingSchedule(false);
        }
    };

    if ((decryptedData || decryptedFileBuffer) && currentVault && countdown) {
        return (
            <div className="relative flex min-h-screen w-full flex-col bg-background-dark font-display">
                <div className="flex h-full grow flex-col">
                    <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 md:px-8 lg:px-12">
                        <div className="flex w-full max-w-5xl flex-col">
                            {/* Header Stats */}
                            <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 mb-8">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div>
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                                                <span className="material-symbols-outlined text-primary text-2xl">lock</span>
                                </div>
                                            <div>
                                                <h1 className="text-2xl font-bold text-white font-display">Vault #{currentVault.id}</h1>
                                                <p className="text-xs text-white/50 font-display">Created {new Date(currentVault.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white/50 mt-2">
                                            <span className="material-symbols-outlined text-base">schedule</span>
                                            <span className="font-display">Release: {new Date(currentVault.releaseTime).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold mb-3 ${
                                            Date.now() < currentVault.releaseTime 
                                                ? 'bg-primary/20 text-primary' 
                                                : 'bg-[#16a34a]/20 text-[#22c55e]'
                                        }`}>
                                            <div className={`h-2 w-2 rounded-full ${
                                                Date.now() < currentVault.releaseTime ? 'bg-primary' : 'bg-[#22c55e]'
                                            }`}></div>
                                            <span>{Date.now() < currentVault.releaseTime ? 'LOCKED' : 'RELEASED'}</span>
                                        </div>
                                        <div className="flex gap-2 text-center">
                                            <div className="bg-zinc-900 border border-white/10 rounded p-2 w-12 sm:w-14">
                                                <div className="text-xl sm:text-2xl font-bold text-primary font-display">{countdown.days}</div>
                                                <div className="text-[10px] uppercase text-white/50 font-bold font-display">Days</div>
                                            </div>
                                            <div className="bg-zinc-900 border border-white/10 rounded p-2 w-12 sm:w-14">
                                                <div className="text-xl sm:text-2xl font-bold text-primary font-display">{countdown.hours}</div>
                                                <div className="text-[10px] uppercase text-white/50 font-bold font-display">Hours</div>
                                            </div>
                                            <div className="bg-zinc-900 border border-white/10 rounded p-2 w-12 sm:w-14">
                                                <div className="text-xl sm:text-2xl font-bold text-primary font-display">{countdown.min}</div>
                                                <div className="text-[10px] uppercase text-white/50 font-bold font-display">Min</div>
                                            </div>
                                            <div className="bg-zinc-900 border border-white/10 rounded p-2 w-12 sm:w-14">
                                                <div className="text-xl sm:text-2xl font-bold text-primary font-display">{countdown.sec}</div>
                                                <div className="text-[10px] uppercase text-white/50 font-bold font-display">Sec</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-white/50 mt-2 font-display">until vault becomes available to heir</div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Action Bar */}
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white font-display">
                                    {currentVault.vaultType === 'file' ? 'Decrypted File' : 'Recovery Phrase'}
                                </h2>
                                <div className="flex gap-2">
                                    {currentVault.vaultType === 'text' && (
                                        <>
                                <button
                                                onClick={() => setHideMnemonic(!hideMnemonic)}
                                                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {hideMnemonic ? 'visibility' : 'visibility_off'}
                                                </span>
                                                <span>{hideMnemonic ? 'Show' : 'Hide'}</span>
                                </button>
                                <button
                                                onClick={copyToClipboard}
                                                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span className="material-symbols-outlined text-lg">content_copy</span>
                                                <span>Copy</span>
                                </button>
                                        </>
                                    )}
                                <button
                                        onClick={clearData}
                                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-transparent px-4 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/10"
                                    >
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                        <span>Clear</span>
                                </button>
                                </div>
                            </div>

                            {/* Content Display */}
                            {currentVault.vaultType === 'file' ? (
                                <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-8 mb-8 flex flex-col items-center text-center">
                                    <span className="material-symbols-outlined text-primary text-6xl mb-4">description</span>
                                    <h3 className="text-lg font-bold text-white mb-2 font-display">{currentVault.fileName || 'Unknown File'}</h3>
                                    {decryptedFileBuffer ? (
                                        <>
                                            <p className="text-sm text-white/50 mb-6 font-display">
                                                File decrypted successfully ({decryptedFileBuffer.byteLength} bytes). Ready for download.
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                                    <button 
                                                    onClick={downloadFile}
                                                    className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 sm:px-6 text-sm font-bold text-black transition-opacity hover:opacity-90 w-full sm:w-auto"
                                                >
                                                    <span className="material-symbols-outlined text-lg shrink-0">download</span>
                                                    <span className="whitespace-nowrap">Download Decrypted File</span>
                                                </button>
                                                <button 
                                                    onClick={downloadEncryptedBackup}
                                                    className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 sm:px-6 text-sm font-bold text-white transition-colors hover:bg-white/5 w-full sm:w-auto"
                                                    >
                                                    <span className="material-symbols-outlined text-lg shrink-0">save</span>
                                                    <span className="whitespace-nowrap">Download Encrypted Backup</span>
                                                    </button>
                                                </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-yellow-500 mb-6 font-display">File data not available</p>
                                    )}
                                </div>
                            ) : (
                    (() => {
                        // Check if this is a txt file or plain text (not mnemonic)
                        const isTxtFile = currentVault.vaultType === 'file' && (
                            currentVault.fileName?.toLowerCase().endsWith('.txt') || 
                            currentVault.mimeType === 'text/plain'
                        );
                        
                        // Check if text content looks like a mnemonic (12 or 24 words, typically 3-8 chars each)
                        const words = decryptedData.trim().split(/\s+/);
                        const isMnemonic = words.length === 12 || words.length === 24 || words.length === 18;
                        const hasMnemonicPattern = isMnemonic && words.every(w => w.length >= 3 && w.length <= 8 && /^[a-z]+$/.test(w.toLowerCase()));
                        
                        const shouldShowAsPlainText = isTxtFile || !hasMnemonicPattern;
                        
                        return shouldShowAsPlainText ? (
                            <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold uppercase text-white/50 font-display">Decrypted Text</h3>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                                    <button 
                                                        onClick={downloadFile}
                                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 sm:px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5 w-full sm:w-auto"
                                        >
                                            <span className="material-symbols-outlined text-lg shrink-0">download</span>
                                            <span className="whitespace-nowrap">Download Text</span>
                                        </button>
                                        <button 
                                            onClick={downloadEncryptedBackup}
                                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 sm:px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5 w-full sm:w-auto"
                                                    >
                                            <span className="material-symbols-outlined text-lg shrink-0">save</span>
                                            <span className="whitespace-nowrap">Encrypted Backup</span>
                                                    </button>
                                                </div>
                                </div>
                                <div className="bg-zinc-900 border border-white/10 rounded-lg p-4">
                                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-white max-h-96 overflow-y-auto">
                                        {hideMnemonic ? '••••••••••••••••••••••••••••••••••••••••' : decryptedData}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold uppercase text-white/50 font-display">Decrypted Mnemonic</h3>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                                    <button 
                                                        onClick={downloadFile}
                                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 sm:px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5 w-full sm:w-auto"
                                        >
                                            <span className="material-symbols-outlined text-lg shrink-0">download</span>
                                            <span className="whitespace-nowrap">Download Text</span>
                                        </button>
                                        <button 
                                            onClick={downloadEncryptedBackup}
                                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 sm:px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5 w-full sm:w-auto"
                                                    >
                                            <span className="material-symbols-outlined text-lg shrink-0">save</span>
                                            <span className="whitespace-nowrap">Encrypted Backup</span>
                                                    </button>
                                                </div>
                                        </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {words.map((word, index) => (
                                        <div key={index} className="bg-zinc-900 border border-white/10 rounded px-3 py-2 flex items-center gap-3">
                                            <span className="text-xs font-mono text-white/50 select-none">{index + 1}</span>
                                            <span className={`font-mono font-medium text-white ${hideMnemonic ? 'blur-sm select-none' : ''}`}>
                                                {hideMnemonic ? '•••••' : word}
                                            </span>
                                    </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()
                                )}

                            {/* Heir Management Section */}
                            <div className="mb-8">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white font-display">
                                    <span className="material-symbols-outlined text-xl">group</span>
                                    <span>Manage Heirs</span>
                                </h2>
                                <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
                                        {isLoadingHeirs ? (
                                            <div className="text-center py-4">
                                            <p className="text-sm text-white/50 font-display">Loading authorized heirs...</p>
                                            </div>
                                    ) : (
                                        <>
                                            {authorizedHeirs.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="text-sm text-white/50 uppercase tracking-wider mb-3 font-display">Authorized Heirs</div>
                                                    <div className="space-y-2">
                                                {authorizedHeirs.map((heirAddress) => (
                                                            <div key={heirAddress} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-white/10">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                                                        <span className="material-symbols-outlined text-primary text-base">person</span>
                                                    </div>
                                                                    <div>
                                                                        <div className="font-mono text-sm text-white">{heirAddress.slice(0, 6)}...{heirAddress.slice(-4)}</div>
                                                                        <div className="text-xs text-white/50 font-display">Authorized</div>
                                            </div>
                                                                </div>
                                                    <button
                                                                    onClick={async () => {
                                                             if (!currentVault || !address) return;
                                                             
                                                             const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
                                                             if (!CONTRACT_ADDRESS) {
                                                                 toast.error("Contract address not configured");
                                                                 return;
                                                             }
                                                             
                                                             setIsRevokingAccess(heirAddress);
                                                             try {
                                                                 toast.info("Revoking access...");
                                                                 const signer = await getSigner();
                                                                 if (!signer) {
                                                                     throw new Error("Failed to get signer");
                                                                 }
                                                                 
                                                         const tx = await revokeAccess(CONTRACT_ADDRESS, signer, currentVault.id, heirAddress);
                                                         toast.info("Waiting for transaction confirmation...");
                                                         await tx.wait();
                                                         
                                                         // Refetch heirs from on-chain data
                                                         await fetchAuthorizedHeirs();
                                                         toast.success("Access revoked successfully");
                                                             } catch (error: any) {
                                                                 console.error('Error revoking access:', error);
                                                                 toast.error(getTransactionErrorMessage(error));
                                                             } finally {
                                                                 setIsRevokingAccess(null);
                                                                    }
                                                                }}
                                                                disabled={isRevokingAccess === heirAddress}
                                                                className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition-colors ${
                                                                    isRevokingAccess === heirAddress
                                                                        ? 'border-red-500/50 bg-red-500/10 text-red-500/50 cursor-not-allowed'
                                                                        : 'border-red-500/50 bg-transparent text-red-500 hover:bg-red-500/10'
                                                                }`}
                                                    >
                                                                <span className="material-symbols-outlined text-lg">person_remove</span>
                                                                <span>{isRevokingAccess === heirAddress ? 'Revoking...' : 'Revoke'}</span>
                                                    </button>
                                                 </div>
                                             ))}
                                         </div>
                                            </div>
                                        )}
                                        
                                            {isManagingHeirs ? (
                                                <div className="animate-fade-in">
                                                    <div className="mb-4">
                                                        <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider font-display">New Heir Address</label>
                                                    <input
                                                        type="text"
                                                        value={newHeirAddress}
                                                        onChange={(e) => setNewHeirAddress(e.target.value)}
                                                        placeholder="0x..."
                                                            className={`w-full rounded-lg border-2 py-3 px-4 text-white bg-zinc-900 placeholder-white/30 focus:outline-none focus:ring-0 font-mono ${
                                                                newHeirAddress && (!ethers.isAddress(newHeirAddress) || 
                                                                newHeirAddress.toLowerCase() === address?.toLowerCase() ||
                                                                authorizedHeirs.some(h => h.toLowerCase() === newHeirAddress.toLowerCase()))
                                                                    ? 'border-red-500' 
                                                                    : 'border-white/10 focus:border-primary'
                                                            }`}
                                                    />
                                                        {newHeirAddress && (!ethers.isAddress(newHeirAddress) || 
                                                            newHeirAddress.toLowerCase() === address?.toLowerCase() ||
                                                            authorizedHeirs.some(h => h.toLowerCase() === newHeirAddress.toLowerCase())) && (
                                                            <p className="text-xs text-red-500 mt-1 font-display">
                                                                {!ethers.isAddress(newHeirAddress)
                                                                    ? 'Invalid Ethereum address'
                                                                    : newHeirAddress.toLowerCase() === address?.toLowerCase()
                                                                    ? 'Cannot add your own address'
                                                                    : 'This address is already authorized'}
                                                            </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={() => {
                                                            setIsManagingHeirs(false);
                                                            setNewHeirAddress('');
                                                        }}
                                                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                                    >
                                                            <span>Cancel</span>
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (!currentVault || !address || !newHeirAddress) return;
                                                     
                                                            if (!ethers.isAddress(newHeirAddress)) {
                                                                toast.error("Invalid Ethereum address");
                                                                return;
                                                            }
                                                     
                                                     if (newHeirAddress.toLowerCase() === address.toLowerCase()) {
                                                         toast.error("Cannot add your own address");
                                                         return;
                                                     }
                                                     
                                                            const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
                                                            if (!CONTRACT_ADDRESS) {
                                                                toast.error("Contract address not configured");
                                                                return;
                                                            }
                                                     
                                                            setIsGrantingAccess(true);
                                                            try {
                                                                toast.info("Granting access...");
                                                                const signer = await getSigner();
                                                         if (!signer) {
                                                             throw new Error("Failed to get signer");
                                                         }
                                                         
                                                                const tx = await grantAccess(CONTRACT_ADDRESS, signer, currentVault.id, newHeirAddress);
                                                                toast.info("Waiting for transaction confirmation...");
                                                                await tx.wait();
                                                         
                                                         // Refetch heirs from on-chain data
                                                                await fetchAuthorizedHeirs();
                                                                setNewHeirAddress('');
                                                                setIsManagingHeirs(false);
                                                                toast.success("Access granted successfully");
                                                            } catch (error: any) {
                                                                console.error('Error granting access:', error);
                                                                toast.error(getTransactionErrorMessage(error));
                                                            } finally {
                                                                setIsGrantingAccess(false);
                                                            }
                                                        }}
                                                        disabled={!newHeirAddress || !ethers.isAddress(newHeirAddress) || isGrantingAccess || 
                                                            newHeirAddress.toLowerCase() === address?.toLowerCase() ||
                                                            authorizedHeirs.some(h => h.toLowerCase() === newHeirAddress.toLowerCase())}
                                                        className={`flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-opacity ${
                                                            !newHeirAddress || !ethers.isAddress(newHeirAddress) || isGrantingAccess ||
                                                            newHeirAddress.toLowerCase() === address?.toLowerCase() ||
                                                            authorizedHeirs.some(h => h.toLowerCase() === newHeirAddress.toLowerCase())
                                                                ? 'bg-primary/50 text-black/50 cursor-not-allowed'
                                                                : 'bg-primary text-black hover:opacity-90'
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">person_add</span>
                                                        <span>{isGrantingAccess ? 'Granting...' : 'Grant Access'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="text-sm text-white/50 uppercase tracking-wider mb-1 font-display">Authorized Heirs</div>
                                                    <div className="text-lg font-bold text-white font-display">
                                                        {authorizedHeirs.length} {authorizedHeirs.length === 1 ? 'heir' : 'heirs'}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setIsManagingHeirs(true)}
                                                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white transition-colors hover:bg-white/5"
                                                >
                                                    <span className="material-symbols-outlined text-lg">person_add</span>
                                                    <span>Add Heir</span>
                                                </button>
                                    </div>
                                )}
                             </>
                         )}
                     </div>
                </div>

                            {/* Reschedule Section */}
                            <div className="mb-8">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white font-display">
                                    <span className="material-symbols-outlined text-xl">calendar_today</span>
                                    <span>Manage Schedule</span>
                                </h2>
                                <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
                                        {!isEditingSchedule ? (
                                        <div className="flex justify-between items-center">
                                                <div>
                                                <div className="text-sm text-white/50 uppercase tracking-wider mb-1 font-display">Current Release Date</div>
                                                <div className="text-lg font-bold text-white font-display">{new Date(currentVault.releaseTime).toLocaleString()}</div>
                                                </div>
                                            <button 
                                                onClick={() => setIsEditingSchedule(true)}
                                                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white transition-colors hover:bg-white/5"
                                            >
                                                <span className="material-symbols-outlined text-lg">schedule</span>
                                                <span>Reschedule</span>
                                            </button>
                                            </div>
                                        ) : (
                                        <div className="animate-fade-in">
                                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                    <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider font-display">New Date</label>
                                                        <input
                                                            type="date"
                                                            value={newReleaseDate}
                                                            onChange={(e) => setNewReleaseDate(e.target.value)}
                                                        className="w-full bg-zinc-900 text-white border-2 border-white/10 rounded-lg px-4 py-3 focus:border-primary focus:outline-none focus:ring-0 transition-all font-display [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" 
                                                        />
                                                    </div>
                                                    <div>
                                                    <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider font-display">New Time</label>
                                                        <input
                                                            type="time"
                                                            value={newReleaseTime}
                                                            onChange={(e) => setNewReleaseTime(e.target.value)}
                                                        className="w-full bg-zinc-900 text-white border-2 border-white/10 rounded-lg px-4 py-3 focus:border-primary focus:outline-none focus:ring-0 transition-all font-display [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={() => setIsEditingSchedule(false)}
                                                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                                    >
                                                    <span>Cancel</span>
                                                    </button>
                                                    <button
                                                        onClick={handleUpdateSchedule}
                                                        disabled={isLoading}
                                                    className={`flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-opacity ${
                                                        isLoading 
                                                            ? 'bg-primary/50 text-black/50 cursor-not-allowed'
                                                            : 'bg-primary text-black hover:opacity-90'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-lg">save</span>
                                                    <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* Warning Banner */}
                            <div className="border border-yellow-500/50 bg-yellow-500/5 rounded-xl p-4 flex items-start gap-4 mb-8">
                                <span className="material-symbols-outlined text-yellow-500 shrink-0 mt-0.5">warning</span>
                                <div>
                                    <h3 className="font-bold text-yellow-500 mb-1 font-display">Security Warning</h3>
                                    <p className="text-sm text-white/70 font-display">
                                        {currentVault.vaultType === 'file' 
                                            ? 'Ensure you download this file to a secure location. Once this window is closed, you will need to decrypt it again.' 
                                            : 'Keep this recovery phrase secure. Never share it with anyone. Anyone with access to these words can control your assets.'}
                                    </p>
                                </div>
                            </div>

                            <div className="text-center pb-8">
                                            <button
                                    onClick={clearData}
                                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-6 text-sm font-bold text-white transition-colors hover:bg-white/5 mx-auto"
                                            >
                                    <span className="material-symbols-outlined text-lg">lock</span>
                                    <span>Lock & Close</span>
                                            </button>
                                    </div>
                            </div>
                        </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-dark font-display">
            <div className="flex h-full grow flex-col">
                <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 md:px-8 lg:px-12">
                    <div className="flex w-full max-w-xl flex-col">
                        <div className="text-center mb-10">
                            <h1 className="text-3xl font-bold mb-2 text-white font-display">Unlock as Owner</h1>
                            <p className="text-white/50 font-display">Enter your credentials to access the vault contents immediately.</p>
                                </div>
                        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wider font-display">Vault ID</label>
                                        <input 
                                            type="text"
                                        placeholder="e.g. mxon2g6" 
                                            {...register('vaultId', { required: 'Vault ID is required', validate: (value) => value.trim().length > 0 || 'Vault ID cannot be empty' })}
                                        className={`w-full rounded-lg border-2 py-3 px-4 text-white bg-zinc-900 placeholder-white/30 focus:outline-none focus:ring-0 font-mono ${
                                            errors.vaultId ? 'border-red-500' : 'border-white/10 focus:border-primary'
                                        }`}
                                        />
                                        {errors.vaultId && (
                                        <p className="text-xs text-red-500 mt-1 font-display">{errors.vaultId.message as string}</p>
                                        )}
                                </div>
                                <p className="text-xs text-white/50 mt-2 font-display">Connect your wallet to unlock vaults. Wallet authentication is used for access control.</p>
                                    <button 
                                        type="submit"
                                        disabled={isLoading}
                                    className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold transition-opacity ${
                                        isLoading 
                                            ? 'bg-primary/50 text-black/50 cursor-not-allowed'
                                            : 'text-black hover:opacity-90'
                                    }`}
                                    >
                                    <span className="material-symbols-outlined text-lg">lock_open</span>
                                    <span>{isLoading ? 'Decrypting...' : 'Decrypt Vault'}</span>
                                    </button>
                                </form>
                            </div>
                            </div>
                        </div>
            </div>
        </div>
    );
};

export default UnlockOwnerPage;