
import React, { useState, useEffect, useContext } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { Lock, Clock, AlertTriangle, Download, FileText, Eye, EyeOff, Copy, Trash2, Save, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getVaultById } from '../services/vaultService';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Badge from '../components/Badge';
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

    // Set vault ID from navigation state if provided
    useEffect(() => {
        if (location.state && location.state.vaultId) {
            setValue('vaultId', location.state.vaultId);
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
                // Fallback to local storage check
                const vault = getVaultById(vaultId);
                if (vault) {
                    setReleaseDate(new Date(vault.releaseTime));
                    if (Date.now() < vault.releaseTime) {
                        setVaultStatus('locked');
                    } else {
                        setVaultStatus('available');
                    }
                } else {
                    setVaultStatus('not-found');
                    setReleaseDate(null);
                }
                return;
            }

            try {
                // Check vault on blockchain
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
            
            // First try to get from local storage (same as Owner unlock)
            let vault = getVaultById(vaultId);
            
            // If not found locally, try to fetch from blockchain
            if (!vault) {
                const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
                if (CONTRACT_ADDRESS && (window as any).ethereum) {
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
                                <Button onClick={downloadFile} icon={<Download size={18} />} size="lg">
                                    Download Decrypted File
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-warning mb-6">File data not available</p>
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
                            <div className="bg-surface border-2 border-border rounded-xl p-6 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold uppercase text-muted">Decrypted Text</h3>
                                    <div className="flex gap-2">
                                        <Button onClick={downloadFile} variant="outline" size="sm" icon={<Download size={16} />}>
                                            Download Text
                                        </Button>
                                    </div>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-4">
                                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-foreground max-h-96 overflow-y-auto">
                                        {hideMnemonic ? '••••••••••••••••••••••••••••••••••••••••' : decryptedData}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-surface border-2 border-border rounded-xl p-6 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold uppercase text-muted">Decrypted Mnemonic</h3>
                                    <div className="flex gap-2">
                                        <Button onClick={downloadFile} variant="outline" size="sm" icon={<Download size={16} />}>
                                            Download Text
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {words.map((word, index) => (
                                        <div key={index} className="bg-background border border-border rounded px-3 py-2 flex items-center gap-3">
                                            <span className="text-xs font-mono text-muted select-none">{(index + 1).toString().padStart(2, '0')}</span>
                                            <span className={`font-mono font-medium ${hideMnemonic ? 'blur-sm select-none' : ''}`}>
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
                <div className="border border-warning/50 bg-warning/5 rounded-xl p-4 flex items-start gap-4 mb-8">
                     <AlertTriangle className="text-warning shrink-0 mt-0.5" />
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

    if (!isConnected) {
        return (
            <div className="max-w-xl mx-auto py-16 px-4">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Unlock as Heir</h1>
                    <p className="text-muted">Connect your wallet to access vaults you've been granted access to.</p>
                </div>
                <Card className="mb-8 text-center py-10">
                    <p className="text-muted mb-6">You need to connect your wallet to unlock vaults.</p>
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <Button onClick={openConnectModal} icon={<Wallet size={18} />}>
                                Connect Wallet
                            </Button>
                        )}
                    </ConnectButton.Custom>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-16 px-4">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Unlock as Heir</h1>
                <p className="text-muted">Claim access to a designated vault using your heir key.</p>
            </div>
            <Card className="mb-8">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Input label="Vault ID" type="text" placeholder="Enter Vault ID (e.g., x5gsyts)" {...register('vaultId', { required: 'Vault ID is required', minLength: { value: 1, message: 'Vault ID must be at least 1 character' } })} error={errors.vaultId?.message as string} />
                    {vaultStatus !== 'idle' && (
                        <div className={`mb-6 p-4 rounded-lg border flex items-center gap-4 ${vaultStatus === 'available' ? 'bg-success/10 border-success/30' : vaultStatus === 'locked' ? 'bg-warning/10 border-warning/30' : vaultStatus === 'unauthorized' ? 'bg-error/10 border-error/30' : 'bg-error/10 border-error/30'}`}>
                            {vaultStatus === 'available' && <Clock className="text-success" />}
                            {vaultStatus === 'locked' && <Lock className="text-warning" />}
                            {(vaultStatus === 'not-found' || vaultStatus === 'unauthorized') && <AlertTriangle className="text-error" />}
                            <div className="flex-1">
                                <div className="text-xs font-bold uppercase mb-1">Status</div>
                                <div className="font-bold">
                                    {vaultStatus === 'available' && "Ready to Unlock"}
                                    {vaultStatus === 'locked' && "Time Locked"}
                                    {vaultStatus === 'not-found' && "Vault Not Found"}
                                    {vaultStatus === 'unauthorized' && "Not Authorized"}
                                </div>
                                {releaseDate && <div className="text-sm font-mono mt-1 opacity-80">Release: {releaseDate.toLocaleDateString()}</div>}
                                {vaultStatus === 'unauthorized' && <div className="text-sm mt-1 opacity-80">The owner must grant you access to this vault.</div>}
                            </div>
                            {vaultStatus === 'locked' && releaseDate && <div className="text-right"><div className="text-xs font-bold uppercase mb-1">Opens In</div><div className="font-mono text-lg font-bold text-warning">{releaseDate.toLocaleDateString()}</div></div>}
                        </div>
                    )}
                    <Button type="submit" fullWidth isLoading={isLoading} disabled={vaultStatus !== 'available'} className="mt-4">
                        {vaultStatus === 'locked' ? 'Vault Locked' : 
                         vaultStatus === 'unauthorized' ? 'Not Authorized' :
                         vaultStatus === 'not-found' ? 'Vault Not Found' :
                         'Unlock Vault'}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default UnlockHeirPage;
