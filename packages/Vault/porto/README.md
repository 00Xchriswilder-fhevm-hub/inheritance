# Porto Integration

This folder contains the Porto SDK integration for LegacyVault.

## Overview

Porto is a passkeys-based wallet that provides secure, passwordless authentication for Web3 applications. It uses EIP-6963 to inject itself as a wallet provider, making it compatible with wallet connection libraries like RainbowKit.

## Files

- `config.ts` - Porto SDK initialization and configuration
- `connector.ts` - Wagmi connector setup for Porto (if needed)

## Usage

Porto is initialized in `index.tsx` when the app starts. It automatically injects itself as a wallet provider via EIP-6963, making it available in RainbowKit's wallet selection modal.

## Features

- **Passkeys Authentication**: Uses WebAuthn/FIDO2 for secure, passwordless authentication
- **EIP-6963 Compatible**: Automatically discovered by wallet connection libraries
- **Sepolia Testnet Support**: Configured to work with Sepolia testnet

## Requirements

- HTTPS (required for WebAuthn/Passkeys)
- Modern browser with WebAuthn support

## Documentation

- [Porto SDK Documentation](https://porto.sh/sdk)
- [EIP-6963 Specification](https://eips.ethereum.org/EIPS/eip-6963)


