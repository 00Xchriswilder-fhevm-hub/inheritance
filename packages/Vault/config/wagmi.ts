import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http, createStorage } from 'wagmi';
import { sepolia } from 'wagmi/chains';

// Get project ID from environment variable or use a default
// Sign up at https://cloud.walletconnect.com to get your project ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';
const sepoliaRpcUrl =
  import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

// Get default wallets from RainbowKit
const { connectors: rainbowKitConnectors } = getDefaultWallets({
  appName: 'LegacyVault',
  projectId: projectId,
});

export const config = createConfig({
  // Keep local/dev traffic on Sepolia only to avoid mainnet ENS lookups
  // that can hit CORS-blocked public RPC endpoints in the browser.
  chains: [sepolia],
  connectors: [
    ...rainbowKitConnectors,
  ],
  storage: createStorage({ storage: localStorage }),
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
  ssr: false,
});

