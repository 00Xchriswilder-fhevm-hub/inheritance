/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_PINATA_JWT: string;
  readonly VITE_IPFS_GATEWAY?: string;
  readonly VITE_FHE_VAULT_CONTRACT_ADDRESS?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extend Window interface to include ethereum provider
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    isMetaMask?: boolean;
    [key: string]: any;
  };
}


