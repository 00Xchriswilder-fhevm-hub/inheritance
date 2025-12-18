import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useConnectors } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getPortoInstance } from '../porto/config';

interface WalletConnectButtonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * Custom wallet connection component with two options:
 * 1. Connect with Porto Passkeys
 * 2. Connect with RainbowKit (opens modal with all wallets)
 */
export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({ 
  className = '',
  variant = 'desktop'
}) => {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const connectors = useConnectors();
  const [showOptions, setShowOptions] = useState(false);
  const connectorsRef = useRef(connectors);
  
  // Update ref when connectors change
  useEffect(() => {
    connectorsRef.current = connectors;
  }, [connectors]);

  // Find Porto connector from available connectors
  // Porto connector ID might be 'xyz.ithaca.porto' or 'porto'
  const portoConnector = connectors.find((connector) => 
    connector.id === 'porto' || 
    connector.id === 'xyz.ithaca.porto' ||
    connector.name?.toLowerCase().includes('porto') ||
    connector.type === 'porto'
  );

  // Restore Porto connection on mount if Porto is already connected
  useEffect(() => {
    if (!isConnected && portoConnector) {
      const portoInstance = getPortoInstance();
      if (portoInstance?.provider) {
        // Check if Porto has an active session
        portoInstance.provider.request({ method: 'eth_accounts' })
          .then((accounts: any) => {
            if (accounts && accounts.length > 0) {
              console.log('Porto has active session, connecting wagmi to Sepolia:', accounts);
              // Connect wagmi to Porto connector on Sepolia
              try {
                connect({ 
                  connector: portoConnector,
                  chainId: 11155111 // Sepolia chain ID
                });
              } catch (err) {
                console.warn('Failed to auto-connect Porto on mount:', err);
              }
            }
          })
          .catch((err) => {
            // No active session or error checking
            console.log('No active Porto session:', err);
          });
      }
    }
  }, [isConnected, portoConnector, connect]);

  const handlePortoConnect = async () => {
    setShowOptions(false);
    
    // First, try to use the connector from wagmi (if Porto injected via EIP-6963)
    if (portoConnector) {
      try {
        console.log('Connecting with Porto connector from wagmi to Sepolia:', portoConnector);
        await connect({ 
          connector: portoConnector,
          chainId: 11155111 // Sepolia chain ID
        });
        return;
      } catch (error) {
        console.error('Failed to connect with Porto connector:', error);
        // Fall through to provider method
      }
    }
    
    // Fallback: Use Porto's provider directly, then connect wagmi
    const portoInstance = getPortoInstance();
    if (!portoInstance || !portoInstance.provider) {
      console.error('Porto instance not available');
      alert('Porto SDK not initialized. Please refresh the page and ensure you are using HTTPS.');
      return;
    }
    
    try {
      console.log('Connecting with Porto provider directly');
      // Step 1: Connect via Porto's provider
      const result = await portoInstance.provider.request({ 
        method: 'wallet_connect' 
      });
      
      console.log('Porto connection result:', result);
      
      // Step 2: Wait for Porto to inject itself via EIP-6963 and wagmi to detect it
      // We'll poll for the connector to appear
      let attempts = 0;
      const maxAttempts = 10;
      
      const tryConnectWagmi = async (): Promise<boolean> => {
        // Get fresh connectors list from ref
        const currentConnectors = connectorsRef.current;
        const portoConn = currentConnectors.find((connector) => 
          connector.id === 'porto' || 
          connector.id === 'xyz.ithaca.porto' ||
          connector.name?.toLowerCase().includes('porto') ||
          connector.type === 'porto'
        );
        
        if (portoConn) {
          console.log('Found Porto connector, connecting wagmi to Sepolia:', portoConn);
          try {
            // Connect to Sepolia specifically
            await connect({ 
              connector: portoConn,
              chainId: 11155111 // Sepolia chain ID
            });
            console.log('Successfully connected wagmi to Porto on Sepolia');
            return true;
          } catch (wagmiError) {
            console.warn('Failed to connect wagmi to Porto connector:', wagmiError);
            return false;
          }
        }
        return false;
      };
      
      // Try immediately
      if (await tryConnectWagmi()) {
        return;
      }
      
      // Poll for connector to appear
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.warn('Porto connector did not appear after connection. Connection may work via provider only.');
          return;
        }
        
        if (await tryConnectWagmi()) {
          clearInterval(pollInterval);
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to connect with Porto:', error);
      alert(`Failed to connect with Porto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isConnected) {
    return (
      <ConnectButton.Custom>
        {({
          account,
          chain: connectedChain,
          openAccountModal,
          openChainModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            connectedChain &&
            (!authenticationStatus ||
              authenticationStatus === 'authenticated');

          if (!ready) {
            return null;
          }

          if (connectedChain?.unsupported) {
            return (
              <button 
                onClick={openChainModal}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5 ${variant === 'mobile' ? 'w-full' : ''} ${className}`}
              >
                <span>Wrong network</span>
              </button>
            );
          }

          // If account is not available, show connect button
          if (!account || !connectedChain) {
            return (
              <button 
                onClick={() => setShowOptions(true)}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition-opacity hover:opacity-90 ${variant === 'mobile' ? 'w-full' : ''} ${className}`}
              >
                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                <span>Connect Wallet</span>
              </button>
            );
          }

          if (variant === 'mobile') {
            return (
              <div className="flex flex-col gap-2 w-full">
                <div className="text-xs font-mono text-center text-white/50">
                  Connected: {account?.displayName || 'Unknown'}
                </div>
                <button 
                  onClick={openAccountModal}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                >
                  <span>Account</span>
                </button>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-4">
              <button
                onClick={openChainModal}
                className="flex items-center gap-2 text-xs font-mono bg-zinc-900 px-3 py-1 rounded border border-white/10 text-white/50 hover:text-white transition-colors"
                type="button"
              >
                {connectedChain.hasIcon && (
                  <div
                    style={{
                      background: connectedChain.iconBackground,
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      overflow: 'hidden',
                      marginRight: 4,
                    }}
                  >
                    {connectedChain.iconUrl && (
                      <img
                        alt={connectedChain.name ?? 'Chain icon'}
                        src={connectedChain.iconUrl}
                        style={{ width: 12, height: 12 }}
                      />
                    )}
                  </div>
                )}
                {connectedChain.name}
              </button>

              <button
                onClick={openAccountModal}
                type="button"
                className="text-xs font-mono bg-zinc-900 px-3 py-1 rounded border border-white/10 text-[#22c55e] hover:bg-zinc-800 transition-colors"
              >
                {account?.displayName || 'Unknown'}
                {account?.displayBalance && 
                 !account.displayBalance.includes('NaN') && 
                 account.displayBalance.trim() !== ''
                  ? ` (${account.displayBalance})`
                  : ''}
              </button>
            </div>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  // Not connected - show two buttons
  return (
    <div className={`relative ${variant === 'mobile' ? 'w-full' : ''}`}>
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className={`flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition-opacity hover:opacity-90 ${variant === 'mobile' ? 'w-full' : ''} ${className}`}
      >
        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
        <span>Connect Wallet</span>
      </button>

      {showOptions && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowOptions(false)}
          />
          
          {/* Options Menu */}
          <div className={`absolute ${variant === 'mobile' ? 'left-0 right-0' : 'right-0'} top-12 mt-2 z-50 bg-black border-2 border-white/10 rounded-lg shadow-lg overflow-hidden min-w-[200px]`}>
            {/* Porto Passkeys Button - Always show */}
            <button
              onClick={handlePortoConnect}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-semibold hover:bg-white/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">fingerprint</span>
              <span>{isConnecting ? 'Connecting...' : 'Connect with Porto Passkeys'}</span>
            </button>
            
            {/* RainbowKit Button */}
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={() => {
                    setShowOptions(false);
                    openConnectModal();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-semibold hover:bg-white/10 transition-colors text-left border-t border-white/10"
                >
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  <span>Connect with RainbowKit</span>
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </>
      )}
    </div>
  );
};

export default WalletConnectButton;

