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
    useEffect(() => {
        if (isConnected && fhevmStatus === 'idle') {
            console.log('🔐 Wallet connected, initializing FHEVM...');
            initializeFhevm();
        }
    }, [isConnected, fhevmStatus, initializeFhevm]);

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


