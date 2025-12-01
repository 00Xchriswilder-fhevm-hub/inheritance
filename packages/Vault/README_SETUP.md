# FHE Vault Setup Guide

## Prerequisites

1. **Pinata Account** - For IPFS storage
   - Sign up at https://app.pinata.cloud
   - Create an API key and get your JWT token

2. **WalletConnect Project ID** - For wallet connections
   - Sign up at https://cloud.walletconnect.com
   - Create a project and get your Project ID

3. **Deployed Contract** - FHELegacyVault contract address
   - Deploy the contract from `sdk/packages/hardhat`
   - Get the contract address after deployment

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
VITE_PINATA_JWT=your_pinata_jwt_here
VITE_FHE_VAULT_CONTRACT_ADDRESS=your_contract_address_here
```

## Installation

```bash
npm install
```

## Getting Your Pinata JWT

1. Go to https://app.pinata.cloud
2. Navigate to **Developers** → **API Keys**
3. Click **New Key**
4. Give it a name and enable:
   - `pinFileToIPFS` permission
5. Copy the **JWT Token**
6. Add it to your `.env.local` file

## Getting Your WalletConnect Project ID

1. Go to https://cloud.walletconnect.com
2. Sign up / Log in
3. Create a new project
4. Copy the **Project ID**
5. Add it to your `.env.local` file

## Project Structure

```
sdk/packages/Vault/
├── utils/
│   ├── encryption.ts      # AES-256-GCM encryption utilities
│   └── fheUtils.ts       # FHE encryption/decryption helpers
├── services/
│   ├── ipfsService.ts           # IPFS upload/download
│   ├── vaultContractService.ts  # Contract interactions
│   └── fheVaultService.ts        # High-level vault operations
└── ...
```

## Usage Example

```typescript
import { createVault, unlockVault } from './services/fheVaultService';
import { useAccount, useWalletClient } from 'wagmi';

// Create a vault
const result = await createVault({
    data: 'my secret mnemonic phrase',
    releaseTimestamp: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
    contractAddress: import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS,
    signer: walletClient,
    userAddress: address,
});

// Unlock a vault (as owner or heir)
const decrypted = await unlockVault({
    vaultId: 1,
    contractAddress: import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS,
    provider: provider,
    signer: walletClient,
    userAddress: address,
    isOwner: true, // or false for heir
});
```

## Encryption Flow

1. **Client-side AES encryption**: Data encrypted with AES-256-GCM
2. **IPFS upload**: Encrypted data uploaded to IPFS → get CID
3. **FHE encryption**: AES key encrypted with FHEVM
4. **On-chain storage**: CID + FHE-encrypted key stored on contract
5. **Access control**: FHE ACL grants/revokes access
6. **Time-lock**: Block timestamp enforces release time

## Important Notes

- **AES Key Storage**: The AES key is needed for owner access. Store it securely!
- **FHE Limitations**: FHE works with numbers, so we convert the AES key to a number
- **IPFS**: Files are encrypted before upload, so IPFS only sees encrypted data
- **Gas Costs**: Only keys stored on-chain, data on IPFS = lower gas costs

## Next Steps

1. Get your Pinata JWT and add to `.env.local`
2. Deploy the contract (see `sdk/packages/hardhat`)
3. Add contract address to `.env.local`
4. Start the dev server: `npm run dev`


