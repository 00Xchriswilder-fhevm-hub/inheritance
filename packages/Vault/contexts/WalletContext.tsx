import React, { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useFhevm } from '@fhevm-sdk';

export const WalletContext = React.createContext<{
    isConnected: boolean;
    address: string | null;
    connectWallet: () => void;
    disconnectWallet: () => void;
}>({
    isConnected: false,
    address: null,
    connectWallet: () => {},
    disconnectWallet: () => {},
});

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { status: fhevmStatus, initialize: initializeFhevm } = useFhevm();

    // Initialize FHEVM as soon as wallet is connected
    // Also re-initialize on mount if wallet is already connected (after page refresh)
    useEffect(() => {
        if (isConnected && (fhevmStatus === 'idle' || fhevmStatus === 'error')) {
            console.log('🔐 Wallet connected, initializing FHEVM...');
            initializeFhevm();
        }
    }, [isConnected, fhevmStatus, initializeFhevm]);
    
    // Also check on mount if wallet is already connected (page refresh scenario)
    useEffect(() => {
        if (isConnected && fhevmStatus === 'idle') {
            // Small delay to ensure ethereum provider is ready
            const timer = setTimeout(() => {
                console.log('🔄 Page refreshed with wallet connected, initializing FHEVM...');
                initializeFhevm();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []); // Only run on mount

    const connectWallet = () => {
        // Connection is handled by RainbowKit ConnectButton
        // This is kept for backward compatibility
    };

    const disconnectWallet = () => {
        disconnect();
    };

    return (
        <WalletContext.Provider
            value={{
                isConnected: isConnected ?? false,
                address: address ?? null,
                connectWallet,
                disconnectWallet,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
};


