import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Box, Clock, Calendar as CalendarIcon, FileText, AlignLeft, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WalletContext } from '../contexts/WalletContext';
import { getVaults } from '../services/vaultService';
import type { Vault } from '../types';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
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

    if (isExpired) return <div className="text-success font-black text-lg uppercase tracking-wider">UNLOCKED</div>;
    if (!timeLeft) return <div className="text-muted text-sm font-mono">Calculating...</div>;

    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className="bg-black border border-border rounded w-12 h-12 flex items-center justify-center mb-1 shadow-sm">
                    <span className="text-xl font-black text-primary">{timeLeft.d}</span>
                </div>
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Days</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="bg-black border border-border rounded w-12 h-12 flex items-center justify-center mb-1 shadow-sm">
                    <span className="text-xl font-black text-primary">{timeLeft.h}</span>
                </div>
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Hrs</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="bg-black border border-border rounded w-12 h-12 flex items-center justify-center mb-1 shadow-sm">
                    <span className="text-xl font-black text-primary">{timeLeft.m}</span>
                </div>
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Min</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="bg-black border border-border rounded w-12 h-12 flex items-center justify-center mb-1 shadow-sm">
                    <span className="text-xl font-black text-primary">{timeLeft.s}</span>
                </div>
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Sec</span>
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

                // Also get vaults from local storage (for backward compatibility)
                const localVaults = getVaults().filter(v => v.ownerAddress === address);
                console.log(`Found ${localVaults.length} vaults in local storage`);

                // Merge vaults: prioritize blockchain data, but keep local data for vaults not on blockchain
                const allVaultIds = new Set([
                    ...blockchainVaults.map(v => String(v.id)),
                    ...localVaults.map(v => String(v.id))
                ]);

                const mergedVaults: Vault[] = [];
                
                // Add blockchain vaults first
                blockchainVaults.forEach(vault => {
                    mergedVaults.push(vault);
                });

                // Add local vaults that aren't on blockchain
                localVaults.forEach(localVault => {
                    if (!allVaultIds.has(String(localVault.id)) || 
                        !blockchainVaults.some(bv => String(bv.id) === String(localVault.id))) {
                        mergedVaults.push(localVault);
                    }
                });

                setVaults(mergedVaults);
                console.log(`Total vaults to display: ${mergedVaults.length}`);
            } catch (error) {
                console.error('Error fetching vaults:', error);
                toast.error('Failed to load vaults');
                // Fallback to local storage only
                const localVaults = getVaults().filter(v => v.ownerAddress === address);
                setVaults(localVaults);
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
             <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Box className="w-20 h-20 text-muted mb-6 opacity-20" />
                <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
                <p className="text-muted mb-8 max-w-md">Connect your wallet to view your created vaults and manage your digital legacy.</p>
                <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                        <Button onClick={openConnectModal} icon={<Wallet size={18} />}>
                            Connect Wallet
                        </Button>
                    )}
                </ConnectButton.Custom>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-12 px-4">
            <div className="flex justify-between items-center mb-12">
                <h1 className="text-4xl font-black uppercase tracking-tighter text-white">My Vaults</h1>
                <div className="flex gap-3">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleRefresh} 
                        icon={<RefreshCw size={16} />}
                        disabled={isLoading}
                    >
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => navigate('/create')} icon={<Plus size={16} />}>
                        Create New
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-surface border-2 border-dashed border-border rounded-xl p-16 text-center">
                    <Loader2 className="w-12 h-12 text-primary mx-auto mb-6 animate-spin" />
                    <h3 className="text-xl font-bold mb-2">Loading Vaults...</h3>
                    <p className="text-muted">Fetching your vaults from the blockchain</p>
                </div>
            ) : vaults.length === 0 ? (
                <div className="bg-surface border-2 border-dashed border-border rounded-xl p-16 text-center">
                    <div className="w-16 h-16 bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-6 text-muted">
                        <Box size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Vaults Found</h3>
                    <p className="text-muted mb-8">You haven't created any vaults yet.</p>
                    <Button onClick={() => navigate('/create')}>Create Your First Vault</Button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
                    {vaults.map((vault) => {
                        const isLocked = Date.now() < vault.releaseTime;
                        const releaseDate = new Date(vault.releaseTime);
                        const createdDate = new Date(vault.createdAt);
                        
                        return (
                            <Card key={vault.id} className="relative group flex flex-col h-full bg-[#121212]" hoverEffect noPadding>
                                <div className="p-6 pb-0 flex justify-between items-start">
                                    <div>
                                        <div className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Vault ID</div>
                                        <div className="text-3xl font-black tracking-tight text-primary">
                                            #{vault.id}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {vault.vaultType === 'file' ? <FileText size={14}/> : <AlignLeft size={14}/>}
                                            <span className="text-xs font-bold uppercase tracking-wide text-muted">
                                                {vault.vaultType === 'file' ? 'File Storage' : 'Mnemonic'}
                                            </span>
                                            {(vault as Vault & { _isOwner?: boolean; _isHeir?: boolean })._isHeir && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">Heir</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant={isLocked ? 'warning' : 'success'} className="px-3 py-1 text-[10px] tracking-widest uppercase">
                                        {isLocked ? 'LOCKED' : 'RELEASED'}
                                    </Badge>
                                </div>
                                
                                <div className="p-6 flex-grow flex flex-col gap-6">
                                    {isLocked && (
                                        <div className="bg-background rounded-lg border border-border p-4">
                                            <div className="text-[10px] text-muted font-bold uppercase tracking-widest mb-3">Unlocks In</div>
                                            <VaultCountdown releaseTime={vault.releaseTime} />
                                        </div>
                                    )}

                                    <div className="space-y-2 mt-auto">
                                        <div className="flex items-center gap-3 text-xs font-medium text-muted">
                                            <CalendarIcon size={14} />
                                            <span>Created: {createdDate.toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-medium text-muted">
                                            <Clock size={14} />
                                            <span>Release: {releaseDate.toLocaleDateString()} {releaseDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 pt-0 mt-auto">
                                    <Button 
                                        variant="secondary" 
                                        className="w-full"
                                        onClick={() => {
                                            const vaultWithRole = vault as Vault & { _isOwner?: boolean; _isHeir?: boolean };
                                            if (vaultWithRole._isOwner) {
                                                navigate('/unlock-owner', { state: { vaultId: vault.id } });
                                            } else {
                                                navigate('/unlock-heir', { state: { vaultId: vault.id } });
                                            }
                                        }}
                                    >
                                        {(vault as Vault & { _isOwner?: boolean })._isOwner ? 'Manage' : 'Unlock as Heir'}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyVaultsPage;