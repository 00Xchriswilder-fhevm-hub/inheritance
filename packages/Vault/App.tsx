import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
// Material Symbols icons are used via className="material-symbols-outlined"
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, ConnectButton, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from './config/wagmi';
import LandingPage from './pages/LandingPage';
import CreateVaultPage from './pages/CreateVaultPage';
import UnlockOwnerPage from './pages/UnlockOwnerPage';
import UnlockHeirPage from './pages/UnlockHeirPage';
import MyVaultsPage from './pages/MyVaultsPage';
import { WalletProvider, WalletContext } from './contexts/WalletContext';
import { ToastProvider } from './contexts/ToastContext';

// Components
// Material Symbols and custom styling used instead of component library

const queryClient = new QueryClient();

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { isConnected, address } = React.useContext(WalletContext);
    const location = useLocation();

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Create Vault', path: '/create' },
        { name: 'Unlock Owner', path: '/unlock-owner' },
        { name: 'Unlock Heir', path: '/unlock-heir' },
        { name: 'My Vaults', path: '/my-vaults' },
    ];

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <nav className="border-b border-white/10 bg-background-dark sticky top-0 z-50 font-display">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer no-underline">
                        <img 
                            src="/logo.png" 
                            alt="LegacyVault Logo" 
                            className="h-10 w-auto"
                        />
                        <span className="font-bold text-xl tracking-tighter text-white font-display">LEGACY<span className="text-primary">VAULT</span></span>
                    </Link>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.path}
                                    className={`px-3 py-2 rounded-md text-sm font-bold uppercase tracking-wide transition-colors font-display ${
                                        location.pathname === link.path 
                                            ? 'text-primary' 
                                            : 'text-white/50 hover:text-white'
                                    }`}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <ConnectButton.Custom>
                            {({
                                account,
                                chain,
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
                                    chain &&
                                    (!authenticationStatus ||
                                        authenticationStatus === 'authenticated');

                                return (
                                    <div
                                        {...(!ready && {
                                            'aria-hidden': true,
                                            'style': {
                                                opacity: 0,
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            },
                                        })}
                                    >
                                        {(() => {
                                            if (!connected) {
                                                return (
                                                    <button 
                                                        onClick={openConnectModal}
                                                        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                                                        <span>Connect Wallet</span>
                                                    </button>
                                                );
                                            }

                                            if (chain.unsupported) {
                                                return (
                                                    <button 
                                                        onClick={openChainModal}
                                                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                                    >
                                                        <span>Wrong network</span>
                                                    </button>
                                                );
                                            }

                                            return (
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={openChainModal}
                                                        className="flex items-center gap-2 text-xs font-mono bg-zinc-900 px-3 py-1 rounded border border-white/10 text-white/50 hover:text-white transition-colors"
                                                        type="button"
                                                    >
                                                        {chain.hasIcon && (
                                                            <div
                                                                style={{
                                                                    background: chain.iconBackground,
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: 999,
                                                                    overflow: 'hidden',
                                                                    marginRight: 4,
                                                                }}
                                                            >
                                                                {chain.iconUrl && (
                                                                    <img
                                                                        alt={chain.name ?? 'Chain icon'}
                                                                        src={chain.iconUrl}
                                                                        style={{ width: 12, height: 12 }}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                        {chain.name}
                                                    </button>

                                                    <button
                                                        onClick={openAccountModal}
                                                        type="button"
                                                        className="text-xs font-mono bg-zinc-900 px-3 py-1 rounded border border-white/10 text-[#22c55e] hover:bg-zinc-800 transition-colors"
                                                    >
                                                        {account.displayName}
                                                        {account.displayBalance && 
                                                         !account.displayBalance.includes('NaN') && 
                                                         account.displayBalance.trim() !== ''
                                                            ? ` (${account.displayBalance})`
                                                            : ''}
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            }}
                        </ConnectButton.Custom>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={toggleMenu}
                            className="inline-flex items-center justify-center p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 focus:outline-none"
                        >
                            <span className="material-symbols-outlined text-2xl">
                                {isOpen ? 'close' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-background-dark border-t border-white/10">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={`block px-3 py-2 rounded-md text-base font-bold uppercase font-display ${
                                    location.pathname === link.path 
                                        ? 'text-primary bg-zinc-900' 
                                        : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <ConnectButton.Custom>
                                {({
                                    account,
                                    chain,
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
                                        chain &&
                                        (!authenticationStatus ||
                                            authenticationStatus === 'authenticated');

                                    if (!ready) {
                                        return null;
                                    }

                                    if (!connected) {
                                        return (
                                            <button 
                                                onClick={openConnectModal}
                                                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition-opacity hover:opacity-90"
                                            >
                                                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                                                <span>Connect Wallet</span>
                                            </button>
                                        );
                                    }

                                    if (chain.unsupported) {
                                        return (
                                            <button 
                                                onClick={openChainModal}
                                                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span>Wrong network</span>
                                            </button>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs font-mono text-center text-white/50">
                                                Connected: {account.displayName}
                                            </div>
                                            <button 
                                                onClick={openAccountModal}
                                                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span>Account</span>
                                            </button>
                                        </div>
                                    );
                                }}
                            </ConnectButton.Custom>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

const Footer = () => (
    <footer className="bg-background-dark border-t border-white/10 mt-auto py-8 font-display">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex justify-center gap-6 mb-4">
                <span className="material-symbols-outlined text-white/50 hover:text-primary cursor-pointer transition-colors text-2xl">shield</span>
                <span className="material-symbols-outlined text-white/50 hover:text-primary cursor-pointer transition-colors text-2xl">vpn_key</span>
                <span className="material-symbols-outlined text-white/50 hover:text-primary cursor-pointer transition-colors text-2xl">lock</span>
            </div>
            <p className="text-white/50 text-sm font-display">© 2025 LegacyVault. Secure Your Digital Legacy.</p>
        </div>
    </footer>
);

const AppContent = () => {
    const location = useLocation();
    const isLandingPage = location.pathname === '/' || location.pathname === '';

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {!isLandingPage && <Navbar />}
            <main className="flex-grow">
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/create" element={<CreateVaultPage />} />
                    <Route path="/unlock-owner" element={<UnlockOwnerPage />} />
                    <Route path="/unlock-heir" element={<UnlockHeirPage />} />
                    <Route path="/my-vaults" element={<MyVaultsPage />} />
                </Routes>
            </main>
            {!isLandingPage && <Footer />}
        </div>
    );
};

const App = () => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#fbd00e',
                        accentColorForeground: '#000000',
                        borderRadius: 'medium',
                        fontStack: 'system',
                    })}
                    modalSize="compact"
                >
                    <ToastProvider>
                        <WalletProvider>
                            <HashRouter>
                                <AppContent />
                            </HashRouter>
                        </WalletProvider>
                    </ToastProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default App;