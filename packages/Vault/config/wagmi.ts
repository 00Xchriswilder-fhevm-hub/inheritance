import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http, createStorage } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { porto } from 'wagmi/connectors';

// Get project ID from environment variable or use a default
// Sign up at https://cloud.walletconnect.com to get your project ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Get default wallets from RainbowKit
const { connectors: rainbowKitConnectors } = getDefaultWallets({
  appName: 'LegacyVault',
  projectId: projectId,
});

// Create wagmi config with Porto connector and RainbowKit connectors
// This follows the Porto SDK documentation pattern using createConfig
export const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    porto({
      chains: [sepolia], // Porto connector for Sepolia
    }),
    ...rainbowKitConnectors, // Include RainbowKit's default connectors
  ],
  storage: createStorage({ storage: localStorage }),
  transports: {
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: false,
});

