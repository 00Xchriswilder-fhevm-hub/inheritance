import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletConnectButtonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * Custom wallet connection component using RainbowKit.
 */
export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  className = '',
  variant = 'desktop'
}) => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain: connectedChain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          connectedChain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!ready) {
          return null;
        }

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition-opacity hover:opacity-90 ${variant === 'mobile' ? 'w-full' : ''} ${className}`}
            >
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              <span>Connect Wallet</span>
            </button>
          );
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
          <div className={`flex items-center gap-4 ${className}`}>
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
};

export default WalletConnectButton;
