# Introduction

## Overview

Legacy Vault is a digital inheritance platform that enables secure storage and time-locked transfer of sensitive digital assets, documents, and information to designated beneficiaries. The platform leverages Fully Homomorphic Encryption (FHE), blockchain technology, and decentralized storage to solve the critical problem of digital asset inheritance in the Web3 ecosystem.

## Problem Statement

The Web3 ecosystem faces a critical challenge: billions of dollars in digital assets are at risk of permanent loss due to inadequate inheritance mechanisms. Traditional solutions fail because they require either sharing private keys while the owner is alive (security risk) or risk permanent loss if keys are not shared (inheritance failure).

Key challenges include:

- Recovery phrases and private keys are frequently lost or forgotten
- No secure mechanism for inheritance planning without compromising security
- Trust issues prevent sharing keys while the owner is alive
- Lack of time-locked access mechanisms for automatic release

Traditional solutions fail because they require:
- ❌ Sharing keys while you're alive (security risk)
- ❌ Trusting third parties (centralization risk)
- ❌ Passwords that can be lost or forgotten
- ❌ Multi-sig setups that require simultaneous availability

## Solution

Legacy Vault addresses these challenges through a multi-layered security architecture combining:

- **Fully Homomorphic Encryption (FHE)**: Enables computation on encrypted data without decryption
- **Blockchain-based Access Control**: Cryptographically enforced permissions via smart contracts
- **Decentralized Storage**: IPFS network for encrypted data storage
- **Time-locked Release**: Blockchain-enforced release mechanisms

The system ensures:

- Decryption keys remain encrypted at all times, even when stored on-chain
- Time-locked access is cryptographically enforced, not trust-based
- Zero-trust architecture eliminates reliance on third parties
- Decentralized infrastructure prevents single points of failure
- Owners maintain full control with ability to access and modify vaults at any time

## Core Capabilities

### Vault Owner Capabilities

- Secure storage of digital content (text, files, documents) with double encryption
- Heir management with ability to grant access to multiple wallet addresses
- Precise time control with exact release date and time configuration
- Full control with immediate access and ability to modify release schedules
- Access revocation capability before release time

### Heir Capabilities

- Automatic access after release time without owner intervention
- Wallet-based authentication eliminating password management
- Secure decryption through FHEVM SDK with ACL enforcement
- Multi-vault access for all authorized vaults

## Technology Stack

### Core Technologies

- **ZAMA FHEVM**: Fully Homomorphic Encryption implementation on Ethereum
- **Ethereum Blockchain**: Smart contract-based access control and time-locking
- **IPFS**: Decentralized content-addressed storage network
- **AES-256-GCM**: Authenticated symmetric encryption for client-side data protection
- **React + TypeScript**: Modern web application framework with type safety

### Supporting Technologies

- **Hardhat**: Smart contract development and testing framework
- **Ethers.js**: Ethereum library for contract interactions
- **RainbowKit**: Wallet connection interface
- **Wagmi**: React hooks for Ethereum interactions
- **Vite**: Modern build tool and development server

## Use Cases

### Cryptocurrency Inheritance
Secure storage of recovery phrases, private keys, and wallet credentials for designated beneficiaries with time-locked access.

### Legal Document Management
Time-locked storage of wills, legal agreements, and critical documents with controlled access mechanisms.

### Digital Asset Succession
Inheritance planning for NFTs, digital collectibles, and blockchain-based assets with automatic release.

### Sensitive Data Protection
Controlled access storage for medical records, financial information, and confidential data requiring time-based release.

### Business Continuity Planning
Secure storage of critical business information, credentials, and operational data for succession planning.

## Why Fully Homomorphic Encryption

Traditional encryption schemes have a fundamental limitation: computation on encrypted data requires decryption first. This creates a security-utility tradeoff where either:

- Keys must be revealed to enable access control, or
- Access control cannot be implemented on encrypted data

Fully Homomorphic Encryption (FHE) eliminates this tradeoff by enabling computation directly on encrypted values. With ZAMA Protocol's FHE implementation:

- Decryption keys remain encrypted even when stored on-chain
- Access control is enforced cryptographically through FHE Access Control Lists
- Key confidentiality is maintained at the protocol level
- Time-locking mechanisms are mathematically guaranteed, not trust-based

## Security Guarantees

The Legacy Vault system provides the following security guarantees:

1. **Confidentiality**: Decryption keys remain encrypted at all times, including when stored on-chain
2. **Access Control**: Only cryptographically authorized addresses can decrypt vault contents
3. **Time-Locking**: Release mechanisms are enforced by blockchain timestamps, not application logic
4. **Immutability**: Access permissions are recorded on-chain and cannot be bypassed
5. **Owner Control**: Vault owners maintain full control with immediate access and modification capabilities

## Documentation Structure

This documentation is organized into the following sections:

- **Problems & Solution**: Detailed analysis of the digital inheritance problem and how Legacy Vault addresses it
- **Architecture**: Technical architecture including system design, encryption flows, and component integration
- **Smart Contract Architecture**: Detailed smart contract structure, functions, and access control mechanisms
- **Project Structure**: Complete project organization and technology integration details
- **Getting Started**: Step-by-step guide for creating and managing vaults
- **Features**: Comprehensive feature documentation
- **Developer Guide**: Technical documentation for developers
- **Security**: Security model, encryption details, and best practices
- **Planned Features**: Roadmap and upcoming features

## Next Steps

To begin using Legacy Vault, proceed to the [Getting Started](./getting-started.md) guide.

For technical details, see the [Architecture](./architecture.md) and [Project Structure](./project-structure.md) documentation.

