<div align="center">
<img width="1200" height="475" alt="FHE Legacy Vault" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🔐 FHE Legacy Vault

A secure digital vault application that uses cutting-edge cryptography to protect sensitive documents and digital assets. Built with **Fully Homomorphic Encryption (FHE)**, **AES-256-GCM**, **IPFS**, and **Ethereum blockchain** for time-locked access control.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)

---

## 🎯 Overview

**FHE Legacy Vault** enables users to securely store wills, legal documents, crypto mnemonics, and files with controlled access. The system combines multiple layers of encryption and blockchain-based access control:

- **Double Encryption**: Data encrypted with AES-256-GCM client-side, then AES keys encrypted with FHE and stored on-chain
- **Time-Locked Access**: Set specific release dates/times for heirs to access vaults
- **Blockchain Access Control**: Authorize specific wallet addresses as heirs with FHEVM Access Control Lists (ACL)
- **IPFS Storage**: Encrypted files stored on decentralized IPFS network
- **Owner Override**: Vault owners can always access their vaults, bypassing time locks

---

## 🏗️ Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Landing Page │  │ Create Vault │  │ Unlock Pages │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                  │                  │
│  ┌──────▼─────────────────▼──────────────────▼───────┐          │
│  │         Services Layer (TypeScript)               │         │
│  │  • fheVaultService.ts  • ipfsService.ts           │         │
│  │  • vaultContractService.ts  • vaultService.ts     │          │
│  └──────┬─────────────────┬──────────────────┬───────┘          │
│         │                 │                  │                  │
│  ┌──────▼─────────────────▼──────────────────▼───────┘          │
│  │              Utils Layer                                     │
│  │  • encryption.ts  • fheUtils.ts  • errorHandler.ts           │
│  └──────┬─────────────────────────────────────────────┘         │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ├─────────────────┐
          │                 │
┌─────────▼─────────┐  ┌───▼──────────────┐  ┌──────────────┐
│  Ethereum Network │  │   IPFS Network   │  │  FHEVM SDK   │
│  (Sepolia/Hardhat)│  │  (Decentralized) │  │  (Encryption)│
│                   │  │                  │  │              │
│  FHELegacyVault   │  │  Encrypted Files │  │  FHE Keys    │
│  Smart Contract   │  │  (CIDs)          │  │              │
└───────────────────┘  └──────────────────┘  └──────────────┘
```

### Encryption Flow

#### **Creating a Vault:**

1. **Client-Side Encryption**:
   ```
   User Data → AES-256-GCM Encryption → Encrypted Blob
   ```

2. **IPFS Upload**:
   ```
   Encrypted Blob → Upload to IPFS → Receive CID (Content Identifier)
   ```

3. **FHE Encryption**:
   ```
   AES Key (32 bytes) → Convert to Number → FHE Encryption → Encrypted Handle
   ```

4. **Blockchain Storage**:
   ```
   CID + Encrypted Handle + Release Timestamp → Smart Contract
   ```

#### **Unlocking a Vault (Owner):**

1. **Retrieve Encrypted Key**: Call `getEncryptedKeyAsOwner()` on contract
2. **FHE Decryption**: Decrypt the handle using FHEVM SDK
3. **Reconstruct AES Key**: Convert decrypted number back to 32-byte key
4. **Download from IPFS**: Fetch encrypted file using CID
5. **AES Decryption**: Decrypt file using reconstructed AES key

#### **Unlocking a Vault (Heir):**

1. **Check Authorization**: Verify heir is authorized and release time has passed
2. **Retrieve Encrypted Key**: Call `getEncryptedKey()` (requires ACL permission)
3. **FHE Decryption**: Decrypt using FHEVM SDK (ACL enforced)
4. **Reconstruct & Decrypt**: Same as owner flow

### Smart Contract Architecture

```solidity
FHELegacyVault Contract
├── Vault Struct
│   ├── cid (string)              // IPFS Content Identifier
│   ├── encryptedKey (euint256)   // FHE-encrypted AES key
│   ├── releaseTimestamp (uint256) // When heirs can access
│   ├── owner (address)           // Vault creator
│   └── createdAt (uint256)      // Creation timestamp
│
├── Access Control
│   ├── authorizedHeirs mapping   // Track authorized addresses
│   ├── grantAccess()             // Grant access before release
│   ├── revokeAccess()            // Revoke access before release
│   └── FHE ACL permissions       // Enforced by Zama FHEVM
│
└── Query Functions
    ├── getVaultMetadata()        // Public vault info
    ├── getUserVaults()          // Vaults created by user
    ├── getHeirVaults()          // Vaults user is heir for
    └── getEncryptedKey()         // Retrieve encrypted key (ACL protected)
```

---

## ✨ Key Features

### 🔒 Security Features

- **Double Encryption**: AES-256-GCM + FHE encryption layers
- **Client-Side Encryption**: Data encrypted before leaving the browser
- **FHE Access Control**: Encrypted keys protected by FHEVM ACL system
- **Time-Locked Release**: Heirs cannot access until release timestamp
- **Owner Override**: Owners can always access their vaults

### 📁 Content Types

- **Text Vaults**: Store mnemonics, private keys, notes, passwords
- **File Vaults**: Store documents, images, any file type
- **IPFS Storage**: Decentralized, immutable file storage

### 👥 Access Management

- **Grant Access**: Authorize specific wallet addresses as heirs
- **Revoke Access**: Remove access before release time
- **Multiple Heirs**: Grant access to multiple addresses at once
- **Vault Tracking**: View all vaults you own or have access to

---

## 🛠️ Technology Stack

### Frontend
- **React** + **TypeScript** - UI framework
- **Tailwind CSS** - Styling
- **RainbowKit** - Wallet connection
- **wagmi** - Ethereum React hooks
- **Vite** - Build tool

### Blockchain & Encryption
- **Hardhat** - Development environment (see `../hardhat/`)
- **Ethers.js** - Ethereum library
- **FHEVM SDK** - Fully Homomorphic Encryption (see `../fhevm-sdk/`)
- **Zama FHEVM** - FHE on Ethereum

### Storage
- **IPFS** - Decentralized file storage
- **Ethereum (Sepolia)** - Smart contract deployment

### Testing
- **Chai** + **Mocha** - Testing framework
- **Hardhat Network** - Local blockchain

---

## 📁 Project Structure

```
Vault/                                 # This package (Frontend Application)
│
├── README.md                          # This file
│
├── pages/                             # React page components
│   ├── LandingPage.tsx                # Home page
│   ├── CreateVaultPage.tsx            # Create vault UI
│   ├── MyVaultsPage.tsx               # List user vaults
│   ├── UnlockOwnerPage.tsx            # Owner unlock UI
│   └── UnlockHeirPage.tsx             # Heir unlock UI
│
├── components/                        # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   └── Badge.tsx
│
├── services/                          # Business logic services
│   ├── fheVaultService.ts             # Main vault orchestration
│   ├── ipfsService.ts                 # IPFS upload/download
│   ├── vaultContractService.ts        # Contract interactions
│   └── vaultService.ts                # High-level vault operations
│
├── hooks/                             # React custom hooks
│   ├── useFheVault.ts                 # FHE operations hook
│   └── useVaultContract.ts            # Contract hook
│
├── utils/                             # Utility functions
│   ├── encryption.ts                  # AES encryption/decryption
│   ├── fheUtils.ts                    # FHE key conversion
│   ├── errorHandler.ts                # Error handling
│   └── vaultIdGenerator.ts            # Vault ID generation
│
├── contexts/                          # React contexts
│   ├── WalletContext.tsx              # Wallet state
│   └── ToastContext.tsx               # Toast notifications
│
├── config/                            # Configuration
│   └── wagmi.ts                       # Wagmi config
│
├── types/                             # TypeScript types
│   └── types.ts
│
├── test/                              # Frontend tests
│   └── FHELegacyVault.test.js
│
├── public/                            # Static assets
│   ├── favicon-*.png
│   └── site.webmanifest
│
├── index.tsx                          # App entry point
├── App.tsx                            # Main app component
├── index.html                         # HTML template
├── vite.config.ts                     # Vite configuration
├── tailwind.config.js                 # Tailwind config
└── package.json
```

### Related Packages (Monorepo Structure)

This package is part of a monorepo. Related packages:

#### `../hardhat/` - Smart Contract Package
- **contracts/**: Solidity smart contracts (`FHELegacyVault.sol`)
- **test/**: Contract unit tests
- **scripts/**: Deployment scripts
- **types/**: Auto-generated TypeScript types from contracts

#### `../fhevm-sdk/` - FHEVM SDK Package
- **adapters/**: Framework-specific adapters (React, Node, Vue)
- **core/**: Core FHEVM functionality

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 7.0.0 (or npm)
- **Git**

### Installation

1. **Navigate to the monorepo root** (if not already there):
   ```bash
   cd ../../  # From this directory, go to sdk/
   ```

2. **Install dependencies** (from monorepo root):
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   
   Create `.env.local` in this directory (`sdk/packages/Vault/.env.local`):
   ```env
   VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
   GEMINI_API_KEY=your_gemini_api_key  # If using AI features
   ```

   Get WalletConnect Project ID: https://cloud.walletconnect.com

4. **Build the SDK** (from monorepo root):
   ```bash
   pnpm sdk:build
   ```

### Running Locally

#### Start Local Blockchain (Hardhat):
```bash
# From monorepo root (sdk/)
pnpm chain

# Or from hardhat directory
cd ../hardhat
npx hardhat node
```

#### Deploy Contracts Locally:
```bash
# From monorepo root
pnpm deploy:localhost

# Or from hardhat directory
cd ../hardhat
npx hardhat run deploy/deploy.ts --network hardhat
```

#### Run Frontend:
```bash
# From this directory (sdk/packages/Vault)
pnpm dev
# or
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in terminal).

---

## 📖 Usage

### Creating a Vault

1. **Connect Wallet**: Click "Connect Wallet" and select your wallet
2. **Navigate to Create**: Click "Create Vault" from landing page
3. **Enter Details**:
   - Choose content type (Text or File)
   - Enter your data or upload file
   - Set release date and time
   - Optionally add metadata (name, description)
4. **Create**: Click "Create Vault" and confirm transaction
5. **Save Vault ID**: Copy the generated vault ID (e.g., "x5gsyts")

### Granting Access to Heirs

1. **Go to My Vaults**: View your created vaults
2. **Select Vault**: Click on a vault
3. **Add Heir**: Enter wallet address and click "Grant Access"
4. **Confirm Transaction**: Approve the blockchain transaction

### Unlocking as Owner

1. **Navigate to Unlock**: Click "Access My Vault" → "Unlock as Owner"
2. **Enter Vault ID**: Paste your vault ID
3. **Unlock**: Click "Unlock Vault"
4. **View Content**: Your decrypted content will be displayed

### Unlocking as Heir

1. **Navigate to Unlock**: Click "Access My Vault" → "Unlock as Heir"
2. **Enter Vault ID**: Enter the vault ID shared by the owner
3. **Check Release Time**: Ensure release time has passed
4. **Unlock**: Click "Unlock Vault" (requires authorization)

---

## 🧪 Testing

### Run Smart Contract Tests

```bash
# From monorepo root
pnpm test

# Or from hardhat directory
cd ../hardhat
npx hardhat test

# Run specific test file
npx hardhat test test/FHELegacyVault.test.js
```

### Test Coverage

The test suite includes:
- ✅ Vault creation with encrypted keys
- ✅ Access control (grant/revoke)
- ✅ Time-locked access enforcement
- ✅ Vault metadata retrieval
- ✅ Error cases and edge cases

**Test Results**: All 13 tests passing ✓

---

## 🚢 Deployment

### Deploy to Sepolia Testnet

1. **Set up environment** (in `../hardhat/.env`):
   ```bash
   PRIVATE_KEY=your_private_key
   INFURA_API_KEY=your_infura_key
   ETHERSCAN_API_KEY=your_etherscan_key
   ```

2. **Deploy contract** (from monorepo root):
   ```bash
   pnpm deploy:sepolia
   # or
   cd ../hardhat
   npx hardhat run deploy/deploy.ts --network sepolia
   ```

3. **Update contract address** in frontend config (`config/wagmi.ts`)

### Build Frontend for Production

```bash
# From this directory
pnpm build
```

Output will be in `dist/` directory, ready for deployment to Vercel, Netlify, or any static hosting.

---

## 🔐 Security Considerations

- **Private Keys**: Never share your wallet private keys
- **Vault IDs**: Keep vault IDs secure - they're needed to unlock vaults
- **AES Keys**: The system handles key management, but ensure you're using a secure wallet
- **Network**: Currently deployed on Sepolia testnet - use test ETH only
- **IPFS**: Files are encrypted before upload, but CID is public on-chain

---

## 📝 License

BSD-3-Clause-Clear

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

<div align="center">
Built with ❤️ using FHEVM, IPFS, and Ethereum
</div>
