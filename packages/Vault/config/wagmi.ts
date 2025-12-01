import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';

// Get project ID from environment variable or use a default
// Sign up at https://cloud.walletconnect.com to get your project ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = getDefaultConfig({
  appName: 'LegacyVault',
  projectId: projectId,
  chains: [sepolia, mainnet],
  ssr: false, // If your dApp uses server-side rendering (SSR)
});

