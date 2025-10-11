# create-fhevm-vue

A CLI to create a Vue app with FHEVM SDK integration.

## Usage

To create a new FHEVM Vue app, run:

```bash
npx create-fhevm-vue my-app
cd my-app
npm install
npm run dev
```

## What you get

- Complete Vue application with FHEVM SDK integration
- Bundled FHEVM SDK (no external dependencies)
- Beautiful Zama-branded UI
- TypeScript support
- Tailwind CSS styling
- Working FHEVM operations (encryption, decryption, contract interactions)
- **Deployed FHE Counter Contract** for testing on Sepolia testnet
- Public decryption demo with hardcoded ciphertexts
- Ready-to-use Vue composables
- **Universal FHEVM SDK** with utilities for:
  - FHEVM initialization
  - Encrypted inputs creation
  - User decryption with EIP-712 signing
  - Public decryption flows

## Deployed FHE Counter Contract

The generated app includes a **pre-deployed FHE Counter Contract** on Sepolia testnet for testing:

- **Contract Address**: `0xead137D42d2E6A6a30166EaEf97deBA1C3D1954e`
- **Network**: Sepolia testnet (Chain ID: 11155111)
- **Features**:
  - Get encrypted count from contract
  - Increment/decrement with encrypted inputs
  - User decryption with EIP-712 signing
  - Public decryption demo

## Features

- ✅ **Self-contained**: No need to install FHEVM SDK separately
- ✅ **Cross-platform**: Works on Windows, Mac, Linux
- ✅ **Zero configuration**: Works out of the box
- ✅ **Production ready**: Includes all necessary files and configurations
- ✅ **Beautiful UI**: Zama design system with Tailwind CSS
- ✅ **Real FHEVM operations**: Actual encryption/decryption functionality
- ✅ **Live contract**: Pre-deployed FHE counter for immediate testing

## Requirements

- Node.js 16 or higher
- npm or yarn
