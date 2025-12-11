
import React, { useState, useEffect, useContext } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
// Material Symbols icons are used via className="material-symbols-outlined"
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useToast } from '../contexts/ToastContext';
import { WalletContext } from '../contexts/WalletContext';
import { getVaultMetadata, isAuthorized } from '../services/vaultContractService';
import { unlockVault } from '../services/fheVaultService';
import { getIPFSMetadata } from '../services/ipfsService';
import { useFheVault } from '../hooks/useFheVault';
import { getTransactionErrorMessage } from '../utils/errorHandler';
import { ethers } from 'ethers';
import type { Vault } from '../types';

const UnlockHeirPage = () => {
    const location = useLocation();
    const { isConnected, address, connectWallet } = useContext(WalletContext);
    const [isLoading, setIsLoading] = useState(false);
    const [vaultStatus, setVaultStatus] = useState<'idle' | 'locked' | 'available' | 'not-found' | 'unauthorized'>('idle');
    const [releaseDate, setReleaseDate] = useState<Date | null>(null);
    const [decryptedData, setDecryptedData] = useState<string | null>(null);
    const [decryptedFileBuffer, setDecryptedFileBuffer] = useState<ArrayBuffer | null>(null);
    const [currentVault, setCurrentVault] = useState<Vault | null>(null);
    const [hideMnemonic, setHideMnemonic] = useState(false);
    const [countdown, setCountdown] = useState<{days: string, hours: string, min: string, sec: string} | null>(null);
    const toast = useToast();
    const { decryptValue } = useFheVault();

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();
    const watchVaultId = watch('vaultId');

    // Set vault ID and vault data from navigation state if provided
    useEffect(() => {
        if (location.state) {
            if (location.state.vaultId) {
            setValue('vaultId', location.state.vaultId);
            }
            // If full vault object is passed, use it immediately
            if (location.state.vault) {
                const vault = location.state.vault as Vault;
                setCurrentVault(vault);
                const releaseTimestamp = vault.releaseTime;
                setReleaseDate(new Date(releaseTimestamp));
                
                // Check if vault is released
                if (Date.now() >= releaseTimestamp) {
                    setVaultStatus('available');
                } else {
                    setVaultStatus('locked');
                }
                console.log('✅ Using vault data from navigation state:', vault);
            }
        }
    }, [location.state, setValue]);

    useEffect(() => {
        const checkVaultStatus = async () => {
            if (!watchVaultId || watchVaultId.trim().length < 1) {
                setVaultStatus('idle');
                setReleaseDate(null);
                return;
            }

            if (!isConnected || !address) {
                setVaultStatus('idle');
                setReleaseDate(null);
                return;
            }

            const vaultId = watchVaultId.trim();
            const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
            
            if (!CONTRACT_ADDRESS) {
                toast.error('Blockchain connection required. Please configure contract address.');
                    setVaultStatus('not-found');
                    setReleaseDate(null);
                return;
            }

            try {
                // Try Supabase first (faster)
                const { vaultService, heirService, isSupabaseConfigured } = await import('../supabase/supabaseService');
                
                if (isSupabaseConfigured()) {
                    try {
                        const dbVault = await vaultService.getVault(vaultId);
                        if (dbVault) {
                            const releaseTimestamp = Math.floor(new Date(dbVault.release_timestamp).getTime() / 1000) * 1000;
                            setReleaseDate(new Date(releaseTimestamp));
                            
                            // Check if current time is past release time
                            if (Date.now() < releaseTimestamp) {
                                setVaultStatus('locked');
                                return;
                            }
                            
                            // Check if user is an active heir in Supabase
                            const heirRecords = await heirService.getHeirsByVault(vaultId, true);
                            const isHeir = heirRecords.some(h => h.heir_address.toLowerCase() === address.toLowerCase());
                            
                            if (isHeir) {
                                setVaultStatus('available');
                                
                                // Set vault data
                                const vault: Vault = {
                                    id: dbVault.vault_id,
                                    ownerAddress: dbVault.owner_address,
                                    encryptedData: dbVault.cid,
                                    cid: dbVault.cid,
                                    releaseTime: releaseTimestamp,
                                    createdAt: Math.floor(new Date(dbVault.created_at).getTime() / 1000) * 1000,
                                    vaultType: (dbVault.vault_type || 'text') as 'text' | 'file',
                                    fileName: dbVault.file_name,
                                    mimeType: dbVault.file_type,
                                    isReleased: Date.now() >= releaseTimestamp,
                                    heirKeyHash: '',
                                    description: `Vault ${dbVault.vault_id}`,
                                };
                                setCurrentVault(vault);
                                console.log('✅ Fetched vault from Supabase');
                                return; // Exit early - use Supabase data
                            } else {
                                setVaultStatus('unauthorized');
                                return;
                            }
                        }
                    } catch (supabaseError) {
                        console.warn('⚠️  Could not fetch from Supabase, falling back to blockchain:', supabaseError);
                    }
                }
                
                // Fallback to blockchain
                if (!(window as any).ethereum) {
                    setVaultStatus('not-found');
                    return;
                }

                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const metadata = await getVaultMetadata(CONTRACT_ADDRESS, provider, vaultId);
                const releaseTimestamp = Number(metadata.releaseTimestamp) * 1000;
                setReleaseDate(new Date(releaseTimestamp));

                // Check if current time is past release time
                if (Date.now() < releaseTimestamp) {
                    setVaultStatus('locked');
                    return;
                }

                // Check if address is authorized
                const authorized = await isAuthorized(CONTRACT_ADDRESS, provider, vaultId, address);
                if (authorized) {
                    setVaultStatus('available');
                } else {
                    setVaultStatus('unauthorized');
                }
            } catch (error) {
                console.error('Error checking vault status:', error);
                setVaultStatus('not-found');
                setReleaseDate(null);
            }
        };

        checkVaultStatus();
    }, [watchVaultId, isConnected, address]);

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

    const onSubmit = async (data: any) => {
        if (vaultStatus === 'locked') {
            toast.error("This vault is still locked by time.");
            return;
        }

        if (vaultStatus === 'unauthorized') {
            toast.error("You are not authorized to access this vault. The owner must grant you access first.");
            return;
        }

        if (!isConnected || !address) {
            toast.error("Please connect your wallet to unlock vaults");
            return;
        }

        setIsLoading(true);
        try {
            const vaultId = data.vaultId.trim();
            
            // Fetch vault from blockchain only
                const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
            if (!CONTRACT_ADDRESS || !(window as any).ethereum) {
                toast.error('Blockchain connection required. Please connect your wallet.');
                setIsLoading(false);
                return;
            }

            let vault;
                    try {
                        const provider = new ethers.BrowserProvider((window as any).ethereum);
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
                        vault = {
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
                    } catch (error) {
                        console.error('Error fetching vault from blockchain:', error);
                toast.error("Vault not found or error fetching from blockchain. Please check the Vault ID.");
                setIsLoading(false);
                return;
            }
            
            if (!vault) {
                toast.error("Vault not found. Please check the Vault ID.");
                setIsLoading(false);
                return;
            }
            
            // For blockchain vaults, we need to use FHE unlock service
            // Check if it's a blockchain vault (has CID or encryptedData looks like an IPFS CID)
            const looksLikeIPFSCID = (str: string) => {
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
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
                    if (!signer) {
                        throw new Error("Failed to get signer");
                    }
            
            // Use FHE unlock service (as heir, not owner)
            const decrypted = await unlockVault({
                vaultId: vaultId,
                contractAddress: CONTRACT_ADDRESS,
                provider: provider,
                signer: signer,
                userAddress: address,
                decryptFn: (handle, contractAddr) => decryptValue(handle, contractAddr),
                isOwner: false, // Heir access
            });

                    // Handle decrypted data based on vault type (same as Owner unlock)
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
                    
                    toast.success("FHE vault decrypted successfully");
                    setIsLoading(false);
                    return;
                } catch (error: any) {
                    console.error('Error unlocking FHE vault:', error);
                    if (error?.message?.includes('not authorized') || error?.message?.includes('Access denied')) {
                        toast.error("You are not authorized to access this vault. The owner must grant you access first.");
                    } else if (error?.message?.includes('release time')) {
                        toast.error("This vault is still locked. Please wait until the release time.");
                    } else {
                        toast.error(getTransactionErrorMessage(error));
                    }
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
            if (error?.message?.includes('not authorized') || error?.message?.includes('Access denied')) {
                toast.error("You are not authorized to access this vault. The owner must grant you access first.");
            } else if (error?.message?.includes('release time')) {
                toast.error("This vault is still locked. Please wait until the release time.");
            } else {
                toast.error(error?.message || "Failed to unlock vault");
            }
        } finally {
            setIsLoading(false);
        }
    };

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

    const clearData = () => {
        setDecryptedData(null);
        setDecryptedFileBuffer(null);
        setCurrentVault(null);
        toast.success("Data cleared from screen");
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
                                            <button 
                                                onClick={downloadFile}
                                                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-black transition-opacity hover:opacity-90"
                                            >
                                                <span className="material-symbols-outlined text-lg">download</span>
                                                <span>Download Decrypted File</span>
                                            </button>
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
                        const words = decryptedData ? decryptedData.trim().split(/\s+/) : [];
                        const isMnemonic = words.length === 12 || words.length === 24 || words.length === 18;
                        const hasMnemonicPattern = isMnemonic && words.every(w => w.length >= 3 && w.length <= 8 && /^[a-z]+$/.test(w.toLowerCase()));
                        
                        const shouldShowAsPlainText = isTxtFile || !hasMnemonicPattern;
                        
                        return shouldShowAsPlainText ? (
                                        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-bold uppercase text-white/50 font-display">Decrypted Text</h3>
                                    <div className="flex gap-2">
                                                    <button 
                                                        onClick={downloadFile}
                                                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">download</span>
                                                        <span>Download Text</span>
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
                            <div className="flex gap-2">
                                                    <button 
                                                        onClick={downloadFile}
                                                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">download</span>
                                                        <span>Download Text</span>
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

    if (!isConnected) {
        return (
            <div className="relative flex min-h-screen w-full flex-col bg-background-dark font-display">
                <div className="flex h-full grow flex-col">
                    <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 md:px-8 lg:px-12">
                        <div className="flex w-full max-w-xl flex-col">
                <div className="text-center mb-10">
                                <h1 className="text-3xl font-bold mb-2 text-white font-display">Unlock as Heir</h1>
                                <p className="text-white/50 font-display">Connect your wallet to access vaults you've been granted access to.</p>
                </div>
                            <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-10 text-center">
                                <p className="text-white/50 mb-6 font-display">You need to connect your wallet to unlock vaults.</p>
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                                        <button 
                                            onClick={openConnectModal}
                                            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-black transition-opacity hover:opacity-90 mx-auto"
                                        >
                                            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                                            <span>Connect Wallet</span>
                                        </button>
                        )}
                    </ConnectButton.Custom>
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
                            <h1 className="text-3xl font-bold mb-2 text-white font-display">Unlock as Heir</h1>
                            <p className="text-white/50 font-display">Claim access to a designated vault using your heir key.</p>
            </div>
                        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 mb-8">
                <form onSubmit={handleSubmit(onSubmit)}>
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wider font-display">Vault ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Vault ID (e.g., x5gsyts)" 
                                        {...register('vaultId', { required: 'Vault ID is required', minLength: { value: 1, message: 'Vault ID must be at least 1 character' } })} 
                                        className={`w-full rounded-lg border-2 py-3 px-4 text-white bg-zinc-900 placeholder-white/30 focus:outline-none focus:ring-0 font-mono ${
                                            errors.vaultId ? 'border-red-500' : 'border-white/10 focus:border-primary'
                                        }`}
                                    />
                                    {errors.vaultId && (
                                        <p className="text-xs text-red-500 mt-1 font-display">{errors.vaultId.message as string}</p>
                                    )}
                                </div>
                    {vaultStatus !== 'idle' && (
                                    <div className={`mb-6 p-4 rounded-lg border flex items-center gap-4 ${
                                        vaultStatus === 'available' ? 'bg-[#16a34a]/10 border-[#22c55e]/30' : 
                                        vaultStatus === 'locked' ? 'bg-primary/10 border-primary/30' : 
                                        'bg-red-500/10 border-red-500/30'
                                    }`}>
                                        {vaultStatus === 'available' && <span className="material-symbols-outlined text-[#22c55e]">schedule</span>}
                                        {vaultStatus === 'locked' && <span className="material-symbols-outlined text-primary">lock</span>}
                                        {(vaultStatus === 'not-found' || vaultStatus === 'unauthorized') && <span className="material-symbols-outlined text-red-500">warning</span>}
                            <div className="flex-1">
                                            <div className="text-xs font-bold uppercase mb-1 text-white/50 font-display">Status</div>
                                            <div className="font-bold text-white font-display">
                                    {vaultStatus === 'available' && "Ready to Unlock"}
                                    {vaultStatus === 'locked' && "Time Locked"}
                                    {vaultStatus === 'not-found' && "Vault Not Found"}
                                    {vaultStatus === 'unauthorized' && "Not Authorized"}
                                </div>
                                            {releaseDate && <div className="text-sm font-mono mt-1 text-white/70">Release: {releaseDate.toLocaleDateString()}</div>}
                                            {vaultStatus === 'unauthorized' && <div className="text-sm mt-1 text-white/70 font-display">The owner must grant you access to this vault.</div>}
                                        </div>
                                        {vaultStatus === 'locked' && releaseDate && (
                                            <div className="text-right">
                                                <div className="text-xs font-bold uppercase mb-1 text-white/50 font-display">Opens In</div>
                                                <div className="font-mono text-lg font-bold text-primary">{releaseDate.toLocaleDateString()}</div>
                            </div>
                                        )}
                        </div>
                    )}
                                <button 
                                    type="submit" 
                                    disabled={isLoading || vaultStatus !== 'available'} 
                                    className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold transition-opacity ${
                                        isLoading || vaultStatus !== 'available'
                                            ? 'bg-primary/50 text-black/50 cursor-not-allowed'
                                            : 'text-black hover:opacity-90'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-lg">lock_open</span>
                                    <span>
                                        {isLoading ? 'Unlocking...' :
                                         vaultStatus === 'locked' ? 'Vault Locked' : 
                         vaultStatus === 'unauthorized' ? 'Not Authorized' :
                         vaultStatus === 'not-found' ? 'Vault Not Found' :
                         'Unlock Vault'}
                                    </span>
                                </button>
                </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnlockHeirPage;
