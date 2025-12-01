import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { Eye, EyeOff, Unlock, Copy, AlertCircle, Trash2, Calendar, Clock, Lock, ArrowLeft, Download, FileText, Save, RefreshCw, Users, UserPlus, UserMinus } from 'lucide-react';
import { getVaultById, mockDecrypt, updateVault } from '../services/vaultService';
import type { Vault } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Badge from '../components/Badge';
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

    // Auto-fill Vault ID if passed from navigation state
    useEffect(() => {
        if (location.state && location.state.vaultId) {
            setValue('vaultId', location.state.vaultId);
        }
    }, [location.state, setValue]);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            // Accept both string and number vault IDs
            const vaultId = data.vaultId.trim();
            
            // First try to get from local storage
            let vault = getVaultById(vaultId);
            
            // If not found locally, try to fetch from blockchain
            if (!vault) {
                const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
                if (CONTRACT_ADDRESS && (window as any).ethereum) {
                    try {
                        const { getVaultMetadata } = await import('../services/vaultContractService');
                        const provider = new (await import('ethers')).BrowserProvider((window as any).ethereum);
                        const metadata = await getVaultMetadata(CONTRACT_ADDRESS, provider, vaultId);
                        
                        // Create vault object from blockchain data
                        vault = {
                            id: vaultId,
                            ownerAddress: metadata.owner,
                            encryptedData: metadata.cid, // IPFS CID
                            cid: metadata.cid,
                            vaultType: 'text' as const,
                            heirKeyHash: '',
                            releaseTime: Number(metadata.releaseTimestamp) * 1000,
                            createdAt: Number(metadata.createdAt) * 1000,
                            isReleased: Date.now() >= Number(metadata.releaseTimestamp) * 1000,
                            description: `Vault ${vaultId}`,
                        };
                    } catch (error) {
                        console.error('Error fetching vault from blockchain:', error);
                        // Continue to show error below
                    }
                }
            }
            
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
                    
                    const provider = signer.provider || new ethers.BrowserProvider((window as any).ethereum);
                    
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
        if (!CONTRACT_ADDRESS || !(window as any).ethereum) return;
        
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
            const provider = new ethers.BrowserProvider((window as any).ethereum);
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
            if (!(window as any).ethereum) {
                throw new Error("No ethereum provider found");
            }
            const provider = new ethers.BrowserProvider((window as any).ethereum);
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

                const provider = signer.provider || new ethers.BrowserProvider((window as any).ethereum);
                
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
                
                // Update local state
                const updatedVault = { ...currentVault, releaseTime: combined.getTime() };
                updateVault(updatedVault);
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
            // Local vault - just update local storage
            const updatedVault = { ...currentVault, releaseTime: combined.getTime() };
            updateVault(updatedVault);
            setCurrentVault(updatedVault);
            setIsEditingSchedule(false);
            toast.success("Release schedule updated");
        }
    };

    if ((decryptedData || decryptedFileBuffer) && currentVault && countdown) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in">
                {/* Header Stats */}
                <div className="bg-surface border-2 border-border rounded-xl p-6 mb-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                                    <Lock className="text-primary w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-foreground">Vault #{currentVault.id}</h1>
                                    <p className="text-xs text-muted">Created {new Date(currentVault.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted mt-2">
                                <Clock size={16} />
                                <span>Release: {new Date(currentVault.releaseTime).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <Badge variant={Date.now() < currentVault.releaseTime ? 'warning' : 'success'} className="mb-3 px-3 py-1">
                                {Date.now() < currentVault.releaseTime ? 'Active' : 'Released'}
                            </Badge>
                            <div className="flex gap-2 text-center">
                                <div className="bg-background border border-border rounded p-2 w-12 sm:w-14">
                                    <div className="text-xl sm:text-2xl font-black text-primary">{countdown.days}</div>
                                    <div className="text-[10px] uppercase text-muted font-bold">Days</div>
                                </div>
                                <div className="bg-background border border-border rounded p-2 w-12 sm:w-14">
                                    <div className="text-xl sm:text-2xl font-black text-primary">{countdown.hours}</div>
                                    <div className="text-[10px] uppercase text-muted font-bold">Hours</div>
                                </div>
                                <div className="bg-background border border-border rounded p-2 w-12 sm:w-14">
                                    <div className="text-xl sm:text-2xl font-black text-primary">{countdown.min}</div>
                                    <div className="text-[10px] uppercase text-muted font-bold">Min</div>
                                </div>
                                <div className="bg-background border border-border rounded p-2 w-12 sm:w-14">
                                    <div className="text-xl sm:text-2xl font-black text-primary">{countdown.sec}</div>
                                    <div className="text-[10px] uppercase text-muted font-bold">Sec</div>
                                </div>
                            </div>
                            <div className="text-xs text-muted mt-2">until vault becomes available to heir</div>
                        </div>
                    </div>
                </div>

                {/* Main Action Bar */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">
                        {currentVault.vaultType === 'file' ? 'Decrypted File' : 'Recovery Phrase'}
                    </h2>
                    <div className="flex gap-2">
                        {currentVault.vaultType === 'text' && (
                            <>
                                <Button size="sm" variant="outline" onClick={() => setHideMnemonic(!hideMnemonic)} icon={hideMnemonic ? <Eye size={14} /> : <EyeOff size={14} />}>
                                    {hideMnemonic ? 'Show' : 'Hide'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={copyToClipboard} icon={<Copy size={14} />}>
                                    Copy
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="danger" onClick={clearData} icon={<Trash2 size={14} />}>
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Content Display */}
                {currentVault.vaultType === 'file' ? (
                    <div className="bg-surface border-2 border-border rounded-xl p-8 mb-8 flex flex-col items-center text-center">
                        <FileText className="w-16 h-16 text-primary mb-4" />
                        <h3 className="text-lg font-bold mb-2">{currentVault.fileName || 'Unknown File'}</h3>
                        {decryptedFileBuffer ? (
                            <>
                                <p className="text-sm text-muted mb-6">
                                    File decrypted successfully ({decryptedFileBuffer.byteLength} bytes). Ready for download.
                                </p>
                                <div className="flex gap-3">
                                    <Button onClick={downloadFile} icon={<Download size={18} />} size="lg">
                                        Download Decrypted File
                                    </Button>
                                    <Button onClick={downloadEncryptedBackup} variant="outline" icon={<Save size={18} />} size="lg">
                                        Download Encrypted Backup
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-warning mb-6">File data not available</p>
                        )}
                    </div>
                ) : (
                    <div className="bg-surface border-2 border-border rounded-xl p-6 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold uppercase text-muted">Decrypted Mnemonic</h3>
                            <div className="flex gap-2">
                                <Button onClick={downloadFile} variant="outline" size="sm" icon={<Download size={16} />}>
                                    Download Text
                                </Button>
                                <Button onClick={downloadEncryptedBackup} variant="outline" size="sm" icon={<Save size={16} />}>
                                    Encrypted Backup
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {decryptedData.trim().split(/\s+/).map((word, index) => (
                                <div key={index} className="bg-background border border-border rounded px-3 py-2 flex items-center gap-3">
                                    <span className="text-xs font-mono text-muted select-none">{(index + 1).toString().padStart(2, '0')}</span>
                                    <span className={`font-mono font-medium ${hideMnemonic ? 'blur-sm select-none' : ''}`}>
                                        {hideMnemonic ? '•••••' : word}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Heir Management Section */}
                <div className="mb-8">
                     <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                         <Users size={20} /> Manage Heirs
                     </h2>
                     <div className="bg-black border-2 border-border rounded-xl p-6">
                         {isLoadingHeirs ? (
                             <div className="text-center py-4">
                                 <p className="text-sm text-muted">Loading authorized heirs...</p>
                             </div>
                         ) : (
                             <>
                                 {authorizedHeirs.length > 0 && (
                                     <div className="mb-4">
                                         <div className="text-sm text-muted uppercase tracking-wider mb-3">Authorized Heirs</div>
                                         <div className="space-y-2">
                                             {authorizedHeirs.map((heirAddress) => (
                                                 <div key={heirAddress} className="flex items-center justify-between bg-surface-hover p-3 rounded-lg border border-border">
                                                     <div className="flex items-center gap-3">
                                                         <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                                             <Users size={14} className="text-primary" />
                                                         </div>
                                                         <div>
                                                             <div className="font-mono text-sm">{heirAddress.slice(0, 6)}...{heirAddress.slice(-4)}</div>
                                                             <div className="text-xs text-muted">Authorized</div>
                                                         </div>
                                                     </div>
                                                     <Button
                                                         size="sm"
                                                         variant="danger"
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
                                                         isLoading={isRevokingAccess === heirAddress}
                                                         icon={<UserMinus size={14} />}
                                                     >
                                                         Revoke
                                                     </Button>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                                 
                                 {isManagingHeirs ? (
                                     <div className="animate-fade-in">
                                         <div className="mb-4">
                                             <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">New Heir Address</label>
                                             <Input
                                                 value={newHeirAddress}
                                                 onChange={(e) => setNewHeirAddress(e.target.value)}
                                                 placeholder="0x..."
                                                 error={
                                                     newHeirAddress && !ethers.isAddress(newHeirAddress)
                                                         ? 'Invalid Ethereum address'
                                                         : newHeirAddress && newHeirAddress.toLowerCase() === address?.toLowerCase()
                                                         ? 'Cannot add your own address'
                                                         : newHeirAddress && authorizedHeirs.some(h => h.toLowerCase() === newHeirAddress.toLowerCase())
                                                         ? 'This address is already authorized'
                                                         : ''
                                                 }
                                             />
                                         </div>
                                         <div className="flex gap-3 justify-end">
                                             <Button variant="outline" size="sm" onClick={() => {
                                                 setIsManagingHeirs(false);
                                                 setNewHeirAddress('');
                                             }}>
                                                 Cancel
                                             </Button>
                                             <Button 
                                                 size="sm" 
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
                                                 disabled={!newHeirAddress || !ethers.isAddress(newHeirAddress) || isGrantingAccess}
                                                 isLoading={isGrantingAccess}
                                                 icon={<UserPlus size={16} />}
                                             >
                                                 Grant Access
                                             </Button>
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="flex justify-between items-center">
                                         <div>
                                             <div className="text-sm text-muted uppercase tracking-wider mb-1">Authorized Heirs</div>
                                             <div className="text-lg font-bold text-foreground">
                                                 {authorizedHeirs.length} {authorizedHeirs.length === 1 ? 'heir' : 'heirs'}
                                             </div>
                                         </div>
                                         <Button variant="outline" onClick={() => setIsManagingHeirs(true)} icon={<UserPlus size={16} />}>
                                             Add Heir
                                         </Button>
                                     </div>
                                 )}
                             </>
                         )}
                     </div>
                </div>

                {/* Reschedule Section */}
                <div className="mb-8">
                     <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                         <Calendar size={20} /> Manage Schedule
                     </h2>
                     <div className="bg-black border-2 border-border rounded-xl p-6">
                         {!isEditingSchedule ? (
                             <div className="flex justify-between items-center">
                                 <div>
                                     <div className="text-sm text-muted uppercase tracking-wider mb-1">Current Release Date</div>
                                     <div className="text-lg font-bold text-foreground">{new Date(currentVault.releaseTime).toLocaleString()}</div>
                                 </div>
                                 <Button variant="outline" onClick={() => setIsEditingSchedule(true)} icon={<RefreshCw size={16} />}>
                                     Reschedule
                                 </Button>
                             </div>
                         ) : (
                             <div className="animate-fade-in">
                                 <div className="grid md:grid-cols-2 gap-4 mb-4">
                                     <div>
                                         <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">New Date</label>
                                         <input 
                                             type="date" 
                                             value={newReleaseDate} 
                                             onChange={(e) => setNewReleaseDate(e.target.value)}
                                             className="w-full bg-surface text-foreground border-2 border-border rounded-lg px-4 py-3 focus:border-primary focus:outline-none focus:shadow-neo transition-all [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" 
                                         />
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">New Time</label>
                                         <input 
                                             type="time" 
                                             value={newReleaseTime} 
                                             onChange={(e) => setNewReleaseTime(e.target.value)}
                                             className="w-full bg-surface text-foreground border-2 border-border rounded-lg px-4 py-3 focus:border-primary focus:outline-none focus:shadow-neo transition-all [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" 
                                         />
                                     </div>
                                 </div>
                                 <div className="flex gap-3 justify-end">
                                     <Button variant="outline" size="sm" onClick={() => setIsEditingSchedule(false)}>Cancel</Button>
                                     <Button size="sm" onClick={handleUpdateSchedule} icon={<Save size={16} />}>Save Changes</Button>
                                 </div>
                             </div>
                         )}
                     </div>
                </div>

                {/* Warning Banner */}
                <div className="border border-warning/50 bg-warning/5 rounded-xl p-4 flex items-start gap-4 mb-8">
                     <AlertCircle className="text-warning shrink-0 mt-0.5" />
                     <div>
                         <h3 className="font-bold text-warning mb-1">Security Warning</h3>
                         <p className="text-sm text-muted">
                             {currentVault.vaultType === 'file' 
                                ? 'Ensure you download this file to a secure location. Once this window is closed, you will need to decrypt it again.' 
                                : 'Keep this recovery phrase secure. Never share it with anyone. Anyone with access to these words can control your assets.'}
                         </p>
                     </div>
                </div>

                <div className="text-center pb-8">
                     <Button variant="secondary" onClick={clearData}>
                        <Lock size={16} className="mr-2" /> Lock & Close
                     </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-16 px-4">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Unlock as Owner</h1>
                <p className="text-muted">Enter your credentials to access the vault contents immediately.</p>
            </div>
            <Card>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Input label="Vault ID" type="text" placeholder="e.g. mxon2g6 or 123456" {...register('vaultId', { required: 'Vault ID is required', validate: (value) => value.trim().length > 0 || 'Vault ID cannot be empty' })} error={errors.vaultId?.message as string} />
                    <p className="text-xs text-muted mt-2">Connect your wallet to unlock vaults. Wallet authentication is used for access control.</p>
                    <Button type="submit" fullWidth isLoading={isLoading} className="mt-4" icon={<Unlock size={18} />}>Decrypt Vault</Button>
                </form>
            </Card>
        </div>
    );
};

export default UnlockOwnerPage;