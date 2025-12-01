import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { Wallet, Menu, X, Shield, Key, Lock } from 'lucide-react';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { config } from './config/wagmi';
import LandingPage from './pages/LandingPage';
import CreateVaultPage from './pages/CreateVaultPage';
import UnlockOwnerPage from './pages/UnlockOwnerPage';
import UnlockHeirPage from './pages/UnlockHeirPage';
import MyVaultsPage from './pages/MyVaultsPage';
import { WalletProvider, WalletContext } from './contexts/WalletContext';
import { ToastProvider } from './contexts/ToastContext';

// Components
import Button from './components/Button';

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
        <nav className="border-b border-border bg-surface sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer no-underline">
                        <Shield className="h-8 w-8 text-primary" />
                        <span className="font-black text-xl tracking-tighter text-foreground">LEGACY<span className="text-primary">VAULT</span></span>
                    </Link>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.path}
                                    className={`px-3 py-2 rounded-md text-sm font-bold uppercase tracking-wide transition-colors ${
                                        location.pathname === link.path 
                                            ? 'text-primary' 
                                            : 'text-muted hover:text-foreground'
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
                                                    <Button variant="primary" size="sm" onClick={openConnectModal} icon={<Wallet size={16} />}>
                                                        Connect Wallet
                                                    </Button>
                                                );
                                            }

                                            if (chain.unsupported) {
                                                return (
                                                    <Button variant="outline" size="sm" onClick={openChainModal}>
                                                        Wrong network
                                                    </Button>
                                                );
                                            }

                                            return (
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={openChainModal}
                                                        className="flex items-center gap-2 text-xs font-mono bg-background px-3 py-1 rounded border border-border text-muted hover:text-foreground transition-colors"
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
                                                        className="text-xs font-mono bg-background px-3 py-1 rounded border border-border text-success hover:bg-surface-hover transition-colors"
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
                            className="inline-flex items-center justify-center p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-hover focus:outline-none"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-surface border-t border-border">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={`block px-3 py-2 rounded-md text-base font-bold uppercase ${
                                    location.pathname === link.path 
                                        ? 'text-primary bg-background' 
                                        : 'text-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="mt-4 pt-4 border-t border-border">
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
                                            <Button variant="primary" fullWidth onClick={openConnectModal} icon={<Wallet size={16} />}>
                                                Connect Wallet
                                            </Button>
                                        );
                                    }

                                    if (chain.unsupported) {
                                        return (
                                            <Button variant="outline" fullWidth onClick={openChainModal}>
                                                Wrong network
                                            </Button>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs font-mono text-center text-muted">
                                                Connected: {account.displayName}
                                            </div>
                                            <Button variant="outline" fullWidth onClick={openAccountModal}>
                                                Account
                                            </Button>
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
    <footer className="bg-surface border-t border-border mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex justify-center gap-6 mb-4">
                <Shield className="text-muted hover:text-primary cursor-pointer transition-colors" />
                <Key className="text-muted hover:text-primary cursor-pointer transition-colors" />
                <Lock className="text-muted hover:text-primary cursor-pointer transition-colors" />
            </div>
            <p className="text-muted text-sm">© 2024 LegacyVault. Secure Your Digital Legacy.</p>
        </div>
    </footer>
);

const App = () => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <ToastProvider>
                        <WalletProvider>
                            <HashRouter>
                                <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
                                    <Navbar />
                                    <main className="flex-grow">
                                        <Routes>
                                            <Route path="/" element={<LandingPage />} />
                                            <Route path="/create" element={<CreateVaultPage />} />
                                            <Route path="/unlock-owner" element={<UnlockOwnerPage />} />
                                            <Route path="/unlock-heir" element={<UnlockHeirPage />} />
                                            <Route path="/my-vaults" element={<MyVaultsPage />} />
                                        </Routes>
                                    </main>
                                    <Footer />
                                </div>
                            </HashRouter>
                        </WalletProvider>
                    </ToastProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default App;