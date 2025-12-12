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
import { vaultService, heirService, userService, isSupabaseConfigured } from '../supabase/supabaseService';

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
        <div className="flex items-center gap-3 mt-2 border-t border-gray-800 pt-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm font-mono">Calculating...</span>
            <div className="flex items-end gap-[2px] h-4 flex-grow opacity-60">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div
                        key={i}
                        className="w-[2px] bg-primary equalizer-bar"
                        style={{
                            animationDelay: `${(i % 4) * 0.1}s`,
                            height: `${[1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1][i] * 4}px`
                        }}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-7 items-center justify-items-center font-mono">
            <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-bold text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    {timeLeft.d}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Days</span>
            </div>
            <span className="text-2xl text-gray-600 pb-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-bold text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    {String(timeLeft.h).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Hours</span>
            </div>
            <span className="text-2xl text-gray-600 pb-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-bold text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    {String(timeLeft.m).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Mins</span>
            </div>
            <span className="text-2xl text-gray-600 pb-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-bold text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                    {String(timeLeft.s).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Secs</span>
            </div>
        </div>
    );
};

const MyVaultsPage = () => {
    const { isConnected, address, connectWallet } = useContext(WalletContext);
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Start as true to show skeletons on initial load
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false); // Track if we've completed initial load
    const navigate = useNavigate();
    const toast = useToast();
    
    const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
    const { readContract, isReady } = useVaultContract(CONTRACT_ADDRESS);

    const fetchVaults = useCallback(async () => {
            if (!isConnected || !address) {
                setVaults([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            // Don't clear vaults immediately - keep showing previous vaults or skeletons
            const startTime = Date.now();
            const MIN_LOADING_TIME = 500; // Minimum 500ms to show skeletons (increased for better UX)
            
            try {
                // Try to get vaults from Supabase first (faster, no blockchain calls needed)
                let supabaseVaults: Vault[] = [];
                if (isSupabaseConfigured()) {
                    try {
                        // Fetch owner and heir vaults in parallel for better performance
                        const [ownerVaults, heirVaults] = await Promise.all([
                            vaultService.getVaultsByOwner(address),
                            heirService.getVaultsByHeir(address)
                        ]);
                        
                        const ownerVaultsMapped = ownerVaults.map((v: any) => {
                            const releaseTimestamp = Math.floor(new Date(v.release_timestamp).getTime() / 1000);
                            return {
                                id: v.vault_id,
                                ownerAddress: v.owner_address,
                                encryptedData: v.cid,
                                cid: v.cid,
                                releaseTime: releaseTimestamp * 1000, // Convert to milliseconds
                                createdAt: Math.floor(new Date(v.created_at).getTime() / 1000) * 1000,
                                vaultType: (v.vault_type || 'text') as 'text' | 'file',
                                fileName: v.file_name,
                                fileType: v.file_type,
                                contentLength: v.content_length,
                                isReleased: Date.now() >= releaseTimestamp * 1000,
                                heirKeyHash: '',
                                description: `Vault ${v.vault_id} (Owner)`,
                                _isOwner: true,
                                _isHeir: false,
                            } as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                        });

                        const heirVaultsMapped = heirVaults.map((v: any) => {
                            const releaseTimestamp = Math.floor(new Date(v.release_timestamp).getTime() / 1000);
                            return {
                                id: v.vault_id,
                                ownerAddress: v.owner_address,
                                encryptedData: v.cid,
                                cid: v.cid,
                                releaseTime: releaseTimestamp * 1000, // Convert to milliseconds
                                createdAt: Math.floor(new Date(v.created_at).getTime() / 1000) * 1000,
                                vaultType: (v.vault_type || 'text') as 'text' | 'file',
                                fileName: v.file_name,
                                fileType: v.file_type,
                                contentLength: v.content_length,
                                isReleased: Date.now() >= releaseTimestamp * 1000,
                                heirKeyHash: '',
                                description: `Vault ${v.vault_id} (Heir)`,
                                _isOwner: false,
                                _isHeir: true,
                            } as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                        });

                        // Combine owner and heir vaults, removing duplicates
                        const allVaultIds = new Set<string>();
                        supabaseVaults = [];
                        
                        // Add owner vaults first
                        for (const vault of ownerVaultsMapped) {
                            if (!allVaultIds.has(String(vault.id))) {
                                allVaultIds.add(String(vault.id));
                                supabaseVaults.push(vault);
                            }
                        }
                        
                        // Add heir vaults (skip if already added as owner)
                        for (const vault of heirVaultsMapped) {
                            if (!allVaultIds.has(String(vault.id))) {
                                allVaultIds.add(String(vault.id));
                                supabaseVaults.push(vault);
                            }
                        }

                        
                        // If we found vaults in Supabase, use them and skip blockchain (unless user forces refresh)
                        if (supabaseVaults.length > 0) {
                            setVaults(supabaseVaults);
                            // Ensure minimum loading time for smooth UX
                            const elapsed = Date.now() - startTime;
                            if (elapsed < MIN_LOADING_TIME) {
                                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
                            }
                            setIsLoading(false);
                            return; // Exit early - use Supabase data only
                        }
                        // If Supabase returned 0 vaults, continue to check blockchain (don't return early)
                    } catch (dbError) {
                    }
                }
                
                // Get vaults from blockchain (fallback or merge)
                let blockchainVaults: Vault[] = [];
                
                if (CONTRACT_ADDRESS && isReady) {
                    try {
                        // Get provider from window.ethereum
                        if (!window.ethereum) {
                            throw new Error('No ethereum provider found');
                        }
                        const provider = new ethers.BrowserProvider(window.ethereum);
                        
                        // Get vaults where user is owner
                        const ownerVaultIds = await getUserVaults(CONTRACT_ADDRESS, provider, address);
                        
                        // Get vaults where user is an authorized heir
                        const heirVaultIds = await getHeirVaults(CONTRACT_ADDRESS, provider, address);
                        
                        // Combine both lists (remove duplicates)
                        const allVaultIds = [...new Set([...ownerVaultIds, ...heirVaultIds])];
                        
                        // Merge Supabase vaults with blockchain vaults (blockchain takes precedence)
                        const supabaseVaultIds = new Set(supabaseVaults.map(v => v.id));
                        const missingVaultIds = allVaultIds.filter(id => !supabaseVaultIds.has(id));

                        // Fetch metadata for missing vaults from blockchain
                        const vaultPromises = missingVaultIds.map(async (vaultId: string) => {
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
                                }
                                
                                // If user is an heir for this vault, create heir record in Supabase
                                if (isHeir && isSupabaseConfigured()) {
                                    try {
                                        // Ensure user (heir) exists in users table
                                        await userService.upsertUser(address);
                                        
                                        // Check if heir record already exists
                                        const existingHeirs = await heirService.getHeirsByVault(vaultId, false);
                                        const heirExists = existingHeirs.some(h => 
                                            h.heir_address.toLowerCase() === address.toLowerCase()
                                        );
                                        
                                        if (!heirExists) {
                                            // Create heir record in Supabase
                                            await heirService.createHeir({
                                                vaultId: vaultId,
                                                heirAddress: address,
                                                grantedAt: new Date(),
                                            });
                                        }
                                    } catch (heirError) {
                                        // Continue anyway - we'll still show the vault
                                    }
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
                                return null;
                            }
                        });

                        const fetchedVaults = await Promise.all(vaultPromises);
                        const missingVaults = fetchedVaults.filter((v): v is Vault => v !== null);
                        blockchainVaults = missingVaults;
                    } catch (error) {
                        toast.error('Failed to fetch vaults from blockchain');
                    }
                }

                // Merge Supabase and blockchain vaults (blockchain takes precedence for duplicates)
                const vaultMap = new Map<string, Vault>();
                supabaseVaults.forEach(vault => vaultMap.set(String(vault.id), vault));
                blockchainVaults.forEach(vault => vaultMap.set(String(vault.id), vault));
                const allVaults = Array.from(vaultMap.values());
                setVaults(allVaults);
            } catch (error) {
                toast.error('Failed to load vaults from blockchain');
                setVaults([]);
            } finally {
                // Ensure minimum loading time for smooth UX (skeletons should be visible)
                // This prevents empty state from flashing when Supabase returns quickly
                const elapsed = Date.now() - startTime;
                const remainingTime = MIN_LOADING_TIME - elapsed;
                if (remainingTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
                // Only set loading to false after minimum time has passed
                setIsLoading(false);
                setHasInitiallyLoaded(true); // Mark that initial load is complete
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
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                        <div 
                                            key={`skeleton-${index}`}
                                            className="relative w-full bg-[#1A1A1A] rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.05)] overflow-hidden border border-gray-800 animate-pulse"
                                        >
                                            {/* Circuit Pattern Background */}
                                            <div 
                                                className="absolute inset-0 opacity-30 pointer-events-none z-0"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L30 10 L30 30 L50 30' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Cpath d='M70 10 L90 10 L90 50' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Cpath d='M10 90 L40 90 L40 70' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%23FFD700' opacity='0.4'/%3E%3Ccircle cx='90' cy='50' r='1.5' fill='%23FFD700' opacity='0.4'/%3E%3C/svg%3E")`,
                                                    backgroundSize: '100px 100px'
                                                }}
                                            />
                                            
                                            <div className="relative z-10 p-6 flex flex-col gap-6">
                                                {/* Header Section Skeleton */}
                                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                    <div className="flex flex-col gap-3 w-full">
                                                        {/* Role Indicator Skeleton */}
                                                        <div className="inline-flex items-center gap-2 border border-primary/30 rounded-full px-3 py-1.5 bg-primary/5 w-fit backdrop-blur-sm">
                                                            <div className="w-4 h-4 bg-primary/20 rounded-full"></div>
                                                            <div className="h-3 w-20 bg-primary/20 rounded"></div>
                                                        </div>
                                                        
                                                        {/* Vault ID Skeleton */}
                                                        <div className="h-10 w-32 bg-white/10 rounded"></div>
                                                        
                                                        {/* Content Type Tag Skeleton */}
                                                        <div className="h-6 w-24 bg-primary/20 rounded-md"></div>
                                                    </div>
                                                    
                                                    {/* Status Badge Skeleton */}
                                                    <div className="absolute top-6 right-6 sm:static">
                                                        <div className="h-6 w-20 bg-primary/20 rounded-full"></div>
                                                    </div>
                                                </div>
                                                
                                                {/* Timer Section Skeleton */}
                                                <div className="relative mt-2 bg-[#333333] rounded-xl p-[1px] overflow-hidden">
                                                    <div className="relative bg-[#111111] rounded-lg p-5 flex flex-col gap-4">
                                                        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-2">
                                                            <div className="h-3 w-24 bg-white/10 rounded"></div>
                                                            <div className="flex gap-1">
                                                                <div className="w-4 h-1.5 bg-primary/20 skew-x-[-20deg]"></div>
                                                                <div className="w-4 h-1.5 bg-primary/20 skew-x-[-20deg]"></div>
                                                                <div className="w-4 h-1.5 bg-primary/20 skew-x-[-20deg]"></div>
                                                                <div className="w-4 h-1.5 bg-primary/20 skew-x-[-20deg]"></div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Countdown Skeleton */}
                                                        <div className="grid grid-cols-7 items-center justify-items-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="h-12 w-12 bg-primary/20 rounded"></div>
                                                                <div className="h-2 w-12 bg-white/10 rounded"></div>
                                                            </div>
                                                            <div className="h-6 w-2 bg-white/10 rounded"></div>
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="h-12 w-12 bg-primary/20 rounded"></div>
                                                                <div className="h-2 w-12 bg-white/10 rounded"></div>
                                                            </div>
                                                            <div className="h-6 w-2 bg-white/10 rounded"></div>
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="h-12 w-12 bg-primary/20 rounded"></div>
                                                                <div className="h-2 w-12 bg-white/10 rounded"></div>
                                                            </div>
                                                            <div className="h-6 w-2 bg-white/10 rounded"></div>
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="h-12 w-12 bg-primary/20 rounded"></div>
                                                                <div className="h-2 w-12 bg-white/10 rounded"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Button Skeleton */}
                                                <div className="w-full h-14 bg-primary/20 rounded-lg"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : vaults.length === 0 && hasInitiallyLoaded ? (
                                // Minimal empty state - only show after initial load is complete
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <p className="text-white/40 text-sm mb-4">No vaults found</p>
                                    <button 
                                        onClick={() => navigate('/create')}
                                        className="flex h-10 min-w-[140px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-5 text-sm font-bold text-black transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-lg text-black">add</span>
                                        <span className="truncate text-black">Create New</span>
                                    </button>
                                </div>
                            ) : vaults.length === 0 ? (
                                // Still loading - show skeletons instead of empty state
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                        <div 
                                            key={`skeleton-fallback-${index}`}
                                            className="relative w-full bg-[#1A1A1A] rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.05)] overflow-hidden border border-gray-800 animate-pulse"
                                        >
                                            <div className="p-6 flex flex-col gap-6">
                                                <div className="h-32 bg-white/5 rounded"></div>
                                                <div className="h-24 bg-white/5 rounded"></div>
                                                <div className="h-14 bg-primary/20 rounded-lg"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {vaults.map((vault) => {
                                        const isLocked = Date.now() < vault.releaseTime;
                                        const releaseDate = new Date(vault.releaseTime);
                                        const vaultWithRole = vault as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                                        const isOwner = vaultWithRole._isOwner;
                                        const isHeir = vaultWithRole._isHeir;
                                        
                                        // Format vault ID - uppercase with # prefix
                                        const formatVaultId = (id: string) => {
                                            if (id.startsWith('0x')) {
                                                return `#${id.slice(2).toUpperCase()}`;
                                            }
                                            return `#${id.toUpperCase()}`;
                                        };
                                        
                                        return (
                                            <div 
                                                key={vault.id} 
                                                className="relative w-full bg-[#1A1A1A] rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.05)] overflow-hidden border border-gray-800"
                                            >
                                                {/* Circuit Pattern Background */}
                                                <div 
                                                    className="absolute inset-0 opacity-30 pointer-events-none z-0"
                                                    style={{
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L30 10 L30 30 L50 30' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Cpath d='M70 10 L90 10 L90 50' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Cpath d='M10 90 L40 90 L40 70' fill='none' stroke='%23FFD700' stroke-width='1' opacity='0.2'/%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%23FFD700' opacity='0.4'/%3E%3Ccircle cx='90' cy='50' r='1.5' fill='%23FFD700' opacity='0.4'/%3E%3C/svg%3E")`,
                                                        backgroundSize: '100px 100px'
                                                    }}
                                                />
                                                
                                                <div className="relative z-10 p-6 flex flex-col gap-6">
                                                    {/* Header Section */}
                                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                        <div className="flex flex-col gap-3 w-full">
                                                            {/* Role Indicator */}
                                                            {isOwner ? (
                                                                <div className="inline-flex items-center gap-2 border border-primary/30 rounded-full px-3 py-1.5 bg-primary/5 w-fit backdrop-blur-sm">
                                                                    <span className="material-symbols-outlined text-primary text-sm">
                                                                        lock_clock
                                                                    </span>
                                                                    <span className="text-primary text-xs font-bold uppercase tracking-wider">
                                                                        Time-Locked
                                                                    </span>
                                                                </div>
                                                            ) : isHeir ? (
                                                                <div className="inline-flex items-center gap-2 border border-primary/30 rounded-full px-3 py-1.5 bg-primary/5 w-fit backdrop-blur-sm">
                                                                    <span className="material-symbols-outlined text-primary text-sm">
                                                                        person
                                                                    </span>
                                                                    <span className="text-primary text-xs font-bold uppercase tracking-wider">
                                                                        Heir
                                                                    </span>
                                                                </div>
                                                            ) : null}
                                                            
                                                            {/* Vault ID */}
                                                            <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                                                                {formatVaultId(String(vault.id))}
                                                            </h1>
                                                            
                                                            {/* Content Type Tag */}
                                                            {vault.vaultType === 'file' ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-primary text-black rounded-md px-2 py-1 w-fit font-bold shadow-[0_0_10px_rgba(255,215,0,0.3),0_0_20px_rgba(255,215,0,0.1)]">
                                                                    <span className="material-symbols-outlined text-sm">description</span>
                                                                    <span className="uppercase text-xs tracking-wide">File</span>
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-1.5 bg-primary text-black rounded-md px-2 py-1 w-fit font-bold shadow-[0_0_10px_rgba(255,215,0,0.3),0_0_20px_rgba(255,215,0,0.1)]">
                                                                    <span className="material-symbols-outlined text-sm">lock</span>
                                                                    <span className="uppercase text-xs tracking-wide">Secret Text</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Status Badge and Lock Icon */}
                                                        <div className="absolute top-6 right-6 sm:static flex flex-col items-end gap-2">
                                                            <div className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 shadow-[0_0_10px_rgba(255,215,0,0.3),0_0_20px_rgba(255,215,0,0.1)] backdrop-blur-md ${
                                                                isLocked 
                                                                    ? 'border-primary bg-black/40' 
                                                                    : 'border-[#22c55e] bg-black/40'
                                                            }`}>
                                                                <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_${isLocked ? '#FFD700' : '#22c55e'}] ${
                                                                    isLocked ? 'bg-primary' : 'bg-[#22c55e]'
                                                                }`}></div>
                                                                <span className={`text-xs font-bold uppercase tracking-wider ${
                                                                    isLocked ? 'text-primary' : 'text-[#22c55e]'
                                                                }`}>
                                                                    {isLocked ? 'Locked' : 'Released'}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Animated Lock Icon (only show when locked) */}
                                                            {isLocked && (
                                                                <div className="relative w-24 h-24 mt-2 hidden sm:flex items-center justify-center">
                                                                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-spin" style={{ animationDuration: '10s' }}></div>
                                                                    <div className="absolute inset-2 bg-primary/5 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.5),0_0_30px_rgba(255,215,0,0.2)] border border-primary/20">
                                                                        <span className="material-symbols-outlined text-primary text-5xl drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]">lock</span>
                                                                    </div>
                                                                    <div className="absolute -left-8 bottom-4 w-8 h-[1px] bg-primary/40"></div>
                                                                    <div className="absolute -left-8 bottom-4 w-[1px] h-8 bg-primary/40 origin-bottom-left rotate-45"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Decorative SVG Lines */}
                                                    <div className="absolute top-36 right-0 w-full h-24 pointer-events-none opacity-40">
                                                        <svg height="100%" preserveAspectRatio="none" viewBox="0 0 400 100" width="100%">
                                                            <path d="M0,50 C100,50 150,80 200,80 L350,80 L400,30" fill="none" opacity="0.4" stroke="#FFD700" strokeWidth="1"></path>
                                                            <path d="M0,60 C80,60 130,90 180,90 L400,90" fill="none" opacity="0.2" stroke="#FFD700" strokeWidth="1"></path>
                                                        </svg>
                                                    </div>
                                                    
                                                    {/* Timer Section */}
                                                    <div className="relative mt-2 bg-[#333333] rounded-xl p-[1px] overflow-hidden">
                                                        <div className="relative bg-[#111111] rounded-lg p-5 flex flex-col gap-4 shadow-inner">
                                                            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-2">
                                                                <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                                                    {isLocked ? 'Unlocks In' : 'Released On'}
                                                                </span>
                                                                {isLocked && (
                                                                    <div className="flex gap-1">
                                                                        <div className="w-4 h-1.5 bg-primary/30 skew-x-[-20deg]"></div>
                                                                        <div className="w-4 h-1.5 bg-primary skew-x-[-20deg] shadow-[0_0_5px_#FFD700]"></div>
                                                                        <div className="w-4 h-1.5 bg-primary/30 skew-x-[-20deg]"></div>
                                                                        <div className="w-4 h-1.5 bg-primary/10 skew-x-[-20deg]"></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {isLocked ? (
                                                                <VaultCountdown releaseTime={vault.releaseTime} />
                                                            ) : (
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="text-2xl font-black text-white leading-tight">
                                                                        {releaseDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                                                                    </p>
                                                                    <p className="text-sm font-medium text-gray-400">
                                                                        {releaseDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Manage Button */}
                                                    <button 
                                                        onClick={() => {
                                                            if (isOwner) {
                                                                navigate('/unlock-owner', { 
                                                                    state: { 
                                                                        vaultId: vault.id,
                                                                        vault: vault
                                                                    } 
                                                                });
                                                            } else {
                                                                navigate('/unlock-heir', { 
                                                                    state: { 
                                                                        vaultId: vault.id,
                                                                        vault: vault
                                                                    } 
                                                                });
                                                            }
                                                        }}
                                                        className="w-full bg-primary hover:bg-yellow-400 text-black font-bold text-lg py-4 rounded-lg shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all transform active:scale-[0.98] uppercase tracking-wide flex items-center justify-center gap-2 group border border-yellow-300/50"
                                                    >
                                                        <span>Manage Vault</span>
                                                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-xl">arrow_forward</span>
                                                    </button>
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