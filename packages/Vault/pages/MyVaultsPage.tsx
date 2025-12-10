import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Loader2, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WalletContext } from '../contexts/WalletContext';
import type { Vault } from '../types';
import { useToast } from '../contexts/ToastContext';
import { getUserVaults, getHeirVaults, getVaultMetadata } from '../services/vaultContractService';
import { useVaultContract } from '../hooks/useVaultContract';
import { ethers } from 'ethers';
import { getIPFSMetadata } from '../services/ipfsService';

// Mini Countdown Component for Cards
const VaultCountdown = ({ releaseTime }: { releaseTime: number }) => {
    const [timeLeft, setTimeLeft] = useState<{d: number, h: number, m: number, s: number} | null>(null);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const calculateTime = () => {
            const now = Date.now();
            const diff = releaseTime - now;
            
            if (diff <= 0) {
                setIsExpired(true);
                setTimeLeft(null);
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft({ d, h, m, s });
        };

        const timer = setInterval(calculateTime, 1000);
        calculateTime();
        return () => clearInterval(timer);
    }, [releaseTime]);

    if (isExpired) return null;
    if (!timeLeft) return (
        <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-white/50 text-sm">Calculating...</span>
        </div>
    );

    return (
        <div className="mt-3 flex items-baseline gap-3">
            <div className="flex flex-col items-center">
                <p className="text-4xl font-black text-white leading-none">
                    {timeLeft.d}
                </p>
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 mt-1">days</span>
            </div>
            <span className="text-2xl font-bold text-white/30 pb-2">:</span>
            <div className="flex flex-col items-center">
                <p className="text-4xl font-black text-white leading-none">
                    {String(timeLeft.h).padStart(2, '0')}
                </p>
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 mt-1">hours</span>
            </div>
            <span className="text-2xl font-bold text-white/30 pb-2">:</span>
            <div className="flex flex-col items-center">
                <p className="text-4xl font-black text-white leading-none">
                    {String(timeLeft.m).padStart(2, '0')}
                </p>
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 mt-1">mins</span>
            </div>
            <span className="text-2xl font-bold text-white/30 pb-2">:</span>
            <div className="flex flex-col items-center">
                <p className="text-4xl font-black text-white leading-none">
                    {String(timeLeft.s).padStart(2, '0')}
                </p>
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 mt-1">secs</span>
            </div>
        </div>
    );
};

const MyVaultsPage = () => {
    const { isConnected, address, connectWallet } = useContext(WalletContext);
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();
    
    const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
    const { readContract, isReady } = useVaultContract(CONTRACT_ADDRESS);

    const fetchVaults = useCallback(async () => {
            if (!isConnected || !address) {
                setVaults([]);
                return;
            }

            setIsLoading(true);
            try {
                // Get vaults from blockchain
                let blockchainVaults: Vault[] = [];
                
                if (CONTRACT_ADDRESS && isReady) {
                    try {
                        console.log('Fetching vaults from blockchain for address:', address);
                        // Get provider from window.ethereum
                        if (!window.ethereum) {
                            throw new Error('No ethereum provider found');
                        }
                        const provider = new ethers.BrowserProvider(window.ethereum);
                        
                        // Get vaults where user is owner
                        const ownerVaultIds = await getUserVaults(CONTRACT_ADDRESS, provider, address);
                        console.log(`Found ${ownerVaultIds.length} owner vaults on blockchain:`, ownerVaultIds);
                        
                        // Get vaults where user is an authorized heir
                        const heirVaultIds = await getHeirVaults(CONTRACT_ADDRESS, provider, address);
                        console.log(`Found ${heirVaultIds.length} heir vaults on blockchain:`, heirVaultIds);
                        
                        // Combine both lists (remove duplicates)
                        const allVaultIds = [...new Set([...ownerVaultIds, ...heirVaultIds])];
                        console.log(`Total unique vaults: ${allVaultIds.length}`);

                        // Fetch metadata for each vault
                        const vaultPromises = allVaultIds.map(async (vaultId: string) => {
                            const isOwner = ownerVaultIds.includes(vaultId);
                            const isHeir = heirVaultIds.includes(vaultId);
                            try {
                                const metadata = await getVaultMetadata(CONTRACT_ADDRESS, provider, vaultId);
                                
                                // Try to determine vault type from IPFS metadata
                                let vaultType: 'text' | 'file' = 'text';
                                try {
                                    const ipfsMetadata = await getIPFSMetadata(metadata.cid);
                                    if (ipfsMetadata?.keyvalues?.type === 'file') {
                                        vaultType = 'file';
                                    }
                                } catch (error) {
                                    // If we can't fetch metadata, default to text
                                    console.warn(`Could not fetch IPFS metadata for vault ${vaultId}:`, error);
                                }
                                
                                return {
                                    id: vaultId,
                                    ownerAddress: metadata.owner,
                                    encryptedData: metadata.cid, // IPFS CID
                                    cid: metadata.cid,
                                    vaultType: vaultType,
                                    heirKeyHash: '',
                                    releaseTime: Number(metadata.releaseTimestamp) * 1000, // Convert to milliseconds
                                    createdAt: Number(metadata.createdAt) * 1000, // Convert to milliseconds
                                    isReleased: Date.now() >= Number(metadata.releaseTimestamp) * 1000,
                                    description: isOwner ? `Vault ${vaultId} (Owner)` : `Vault ${vaultId} (Heir)`,
                                    _isOwner: isOwner,
                                    _isHeir: isHeir,
                                } as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                            } catch (error) {
                                console.error(`Error fetching metadata for vault ${vaultId}:`, error);
                                return null;
                            }
                        });

                        const fetchedVaults = await Promise.all(vaultPromises);
                        blockchainVaults = fetchedVaults.filter((v): v is Vault => v !== null);
                        console.log(`Successfully fetched ${blockchainVaults.length} vaults from blockchain`);
                    } catch (error) {
                        console.error('Error fetching vaults from blockchain:', error);
                        toast.error('Failed to fetch vaults from blockchain');
                    }
                }

                // Use blockchain vaults only - no local storage fallback
                setVaults(blockchainVaults);
                console.log(`Total vaults to display: ${blockchainVaults.length}`);
            } catch (error) {
                console.error('Error fetching vaults:', error);
                toast.error('Failed to load vaults from blockchain');
                setVaults([]);
            } finally {
                setIsLoading(false);
            }
    }, [isConnected, address, CONTRACT_ADDRESS, isReady, toast]);

    useEffect(() => {
        fetchVaults();
    }, [fetchVaults]);

    const handleRefresh = () => {
        fetchVaults();
    };


    if (!isConnected) {
        return (
            <div className="relative flex min-h-screen w-full flex-col bg-background-dark">
                <div className="flex h-full grow flex-col">
                    <div className="flex flex-1 items-center justify-center px-4 py-20">
                        <div className="flex flex-col items-center justify-center text-center max-w-md">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                                <div className="relative bg-[#1A1A1A] border border-white/10 rounded-2xl p-8">
                                    <span className="material-symbols-outlined text-6xl text-primary">account_balance_wallet</span>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold mb-3 text-white">Connect Your Wallet</h2>
                            <p className="text-white/60 mb-8 leading-relaxed">Connect your wallet to view your created vaults and manage your digital legacy securely.</p>
                            <ConnectButton.Custom>
                                {({ openConnectModal }) => (
                                    <button 
                                        onClick={openConnectModal}
                                        className="flex h-12 min-w-[160px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-primary/20"
                                    >
                                        <Wallet size={18} className="text-black" />
                                        <span className="text-black">Connect Wallet</span>
                                    </button>
                                )}
                            </ConnectButton.Custom>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-dark">
            <div className="flex h-full grow flex-col">
                <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 md:px-8 lg:px-12">
                    <div className="flex w-full max-w-7xl flex-col">
                        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-8 mb-4">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-4xl font-black text-white md:text-5xl tracking-tight">My Vaults</h1>
                                <p className="text-white/50 text-sm font-medium">
                                    {vaults.length === 0 ? 'No vaults yet' : `${vaults.length} ${vaults.length === 1 ? 'vault' : 'vaults'}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleRefresh}
                                    disabled={isLoading}
                                    className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#1A1A1A] text-white/70 transition-all hover:bg-white/5 hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Refresh vaults"
                                >
                                    <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/create')}
                                    className="flex h-10 min-w-[140px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-5 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-primary/20"
                                >
                                    <span className="material-symbols-outlined text-lg text-black">add</span>
                                    <span className="truncate text-black">Create New</span>
                                </button>
                            </div>
                        </header>

                        <main className="flex-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                                        <Loader2 className="relative w-16 h-16 text-primary animate-spin" />
                                    </div>
                                    <p className="mt-6 text-white/60 text-sm font-medium">Loading your vaults...</p>
                                </div>
                            ) : vaults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full"></div>
                                        <div className="relative bg-[#1A1A1A] border border-white/10 rounded-2xl p-12">
                                            <span className="material-symbols-outlined text-7xl text-white/20">lock</span>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-3">No Vaults Found</h3>
                                    <p className="text-white/60 mb-8 max-w-md leading-relaxed">You haven't created any vaults yet. Create your first vault to secure your digital legacy.</p>
                                    <button 
                                        onClick={() => navigate('/create')}
                                        className="flex h-12 min-w-[160px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-lg text-black">add</span>
                                        <span className="truncate text-black">Create Your First Vault</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {vaults.map((vault) => {
                                        const isLocked = Date.now() < vault.releaseTime;
                                        const releaseDate = new Date(vault.releaseTime);
                                        const vaultWithRole = vault as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                                        const isOwner = vaultWithRole._isOwner;
                                        const isHeir = vaultWithRole._isHeir;
                                        
                                        // Format vault ID - use # prefix like old design
                                        const formatVaultId = (id: string) => {
                                            if (id.startsWith('0x')) {
                                                return `#${id.slice(2)}`;
                                            }
                                            return `#${id}`;
                                        };
                                        
                                        return (
                                            <div 
                                                key={vault.id} 
                                                className="group relative flex flex-col rounded-xl border border-white/10 bg-gradient-to-br from-[#1A1A1A] to-[#151515] p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 overflow-hidden"
                                            >
                                                {/* Subtle gradient overlay on hover */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-300 pointer-events-none"></div>
                                                
                                                <div className="relative z-10 flex flex-col h-full">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`material-symbols-outlined text-lg ${
                                                                isOwner ? 'text-primary' : 'text-white/60'
                                                            }`}>
                                                                {isOwner ? 'lock_clock' : 'person'}
                                                            </span>
                                                            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                                                                {isOwner ? 'Time-Locked' : 'Heir'}
                                                            </p>
                                                        </div>
                                                        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider backdrop-blur-sm ${
                                                            isLocked 
                                                                ? 'bg-primary/20 text-primary border border-primary/30' 
                                                                : 'bg-[#16a34a]/20 text-[#22c55e] border border-[#22c55e]/30'
                                                        }`}>
                                                            <div className={`h-2 w-2 rounded-full animate-pulse ${
                                                                isLocked ? 'bg-primary' : 'bg-[#22c55e]'
                                                            }`}></div>
                                                            <span>{isLocked ? 'LOCKED' : 'RELEASED'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Vault ID */}
                                                    <div className="mb-4">
                                                        <p className="text-3xl font-black text-primary tracking-tight leading-none">
                                                            {formatVaultId(String(vault.id))}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Content Type Tag */}
                                                    <div className="mb-6 flex items-center gap-2">
                                                        {vault.vaultType === 'file' ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                                                                <span className="material-symbols-outlined text-sm text-white/70">description</span>
                                                                <span className="text-xs font-bold uppercase tracking-wide text-white/60">File</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                                                                <span className="material-symbols-outlined text-sm text-white/70">lock</span>
                                                                <span className="text-xs font-bold uppercase tracking-wide text-white/60">Secret Text</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Content Section */}
                                                    <div className="mt-auto flex flex-1 flex-col justify-end pt-4 border-t border-white/5">
                                                        {isLocked ? (
                                                            <div>
                                                                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Unlocks In</p>
                                                                <VaultCountdown releaseTime={vault.releaseTime} />
                                                                <button 
                                                                    onClick={() => {
                                                                        if (isOwner) {
                                                                            navigate('/unlock-owner', { state: { vaultId: vault.id } });
                                                                        } else {
                                                                            navigate('/unlock-heir', { state: { vaultId: vault.id } });
                                                                        }
                                                                    }}
                                                                    className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-primary/20"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">settings</span>
                                                                    <span className="text-black">Manage</span>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Released On</p>
                                                                <div className="mb-2">
                                                                    <p className="text-2xl font-black text-white leading-tight">
                                                                        {releaseDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                                                                    </p>
                                                                    <p className="mt-1.5 text-sm font-medium text-white/60">
                                                                        {releaseDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                    </p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (isOwner) {
                                                                            navigate('/unlock-owner', { state: { vaultId: vault.id } });
                                                                        } else {
                                                                            navigate('/unlock-heir', { state: { vaultId: vault.id } });
                                                                        }
                                                                    }}
                                                                    className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-primary/20"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">settings</span>
                                                                    <span className="text-black">Manage</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyVaultsPage;