# Project Structure

This document provides a comprehensive overview of the Legacy Vault project structure, including how IPFS, FHE, and AES encryption integrate to create a secure digital inheritance system.


## Technology Integration

### How IPFS, FHE, and AES Work Together

The Legacy Vault system integrates three core technologies to provide secure, time-locked digital inheritance:

#### 1. AES-256-GCM Encryption (Client-Side)

**Location**: `packages/Vault/utils/encryption.ts`

**Purpose**: First layer of encryption for user data

**Process**:
```typescript
// Generate random 32-byte AES key
const aesKey = crypto.getRandomValues(new Uint8Array(32));

// Encrypt data with AES-256-GCM
const encryptedData = await encryptAES(data, aesKey);

// Result: Encrypted blob ready for IPFS upload
```

**Key Characteristics**:
- Symmetric encryption (same key encrypts and decrypts)
- Authenticated encryption (GCM mode provides integrity)
- Fast encryption/decryption
- 256-bit key strength

**Files Involved**:
- `utils/encryption.ts`: Encryption/decryption functions
- `services/fheVaultService.ts`: Orchestrates encryption process

#### 2. IPFS Storage (Decentralized)

**Location**: `packages/Vault/services/ipfsService.ts`

**Purpose**: Store encrypted data on decentralized network

**Process**:
```typescript
// Upload encrypted blob to IPFS
const ipfsClient = createIPFSClient();
const result = await ipfsClient.add(encryptedBlob);

// Receive Content Identifier (CID)
const cid = result.path; // e.g., "QmXxxx..."

// CID is stored on blockchain, encrypted data on IPFS
```

**Key Characteristics**:
- Content-addressed storage (CID = cryptographic hash)
- Decentralized network (no single point of failure)
- Immutable (content cannot be changed)
- Redundant storage across IPFS nodes

**Files Involved**:
- `services/ipfsService.ts`: IPFS upload/download functions
- `services/fheVaultService.ts`: Coordinates IPFS operations

#### 3. FHE Encryption (On-Chain)

**Location**: `packages/Vault/services/fheVaultService.ts`, `packages/hardhat/contracts/FHELegacyVault.sol`

**Purpose**: Encrypt AES key with Fully Homomorphic Encryption for on-chain storage

**Process**:
```typescript
// Convert 32-byte AES key to number
const keyAsNumber = bytesToNumber(aesKey);

// Encrypt with FHE using FHEVM SDK
const fheInstance = await getFheInstance();
const encryptedKey = await fheInstance.encrypt(
    contractAddress,
    keyAsNumber
);

// Store encrypted key on blockchain
await contract.createVault(
    vaultId,
    cid,              // IPFS CID
    encryptedKey,     // FHE-encrypted AES key
    inputProof,       // FHE proof
    releaseTimestamp
);
```

**Key Characteristics**:
- Homomorphic encryption (can compute on encrypted data)
- Access Control Lists (ACL) for permission management
- Keys remain encrypted even on blockchain
- Only authorized addresses can decrypt

**Files Involved**:
- `services/fheVaultService.ts`: FHE encryption/decryption
- `utils/fheUtils.ts`: Key conversion utilities
- `hooks/useFheVault.ts`: React hook for FHE operations
- `contracts/FHELegacyVault.sol`: Smart contract storage

## Complete Data Flow

### Vault Creation Flow

```
User Input (Text/File)
    ↓
[1. AES Encryption]
    ├─> Generate 32-byte AES key
    ├─> Encrypt data with AES-256-GCM
    └─> Result: Encrypted blob
    ↓
[2. IPFS Upload]
    ├─> Upload encrypted blob to IPFS
    ├─> Receive Content Identifier (CID)
    └─> Result: CID string (e.g., "QmXxxx...")
    ↓
[3. FHE Encryption]
    ├─> Convert AES key (32 bytes) to number
    ├─> Encrypt number with FHE via FHEVM
    ├─> Generate FHE input proof
    └─> Result: FHE-encrypted key (euint256)
    ↓
[4. Blockchain Storage]
    ├─> Call createVault() on smart contract
    ├─> Store: CID, encryptedKey, releaseTimestamp
    ├─> Grant owner FHE ACL permission
    └─> Result: Vault created on-chain
```

### Vault Unlock Flow (Owner)

```
Owner Request
    ↓
[1. Retrieve Encrypted Key]
    ├─> Call getEncryptedKeyAsOwner() on contract
    └─> Result: FHE-encrypted key (euint256)
    ↓
[2. FHE Decryption]
    ├─> Use FHEVM SDK to decrypt
    ├─> Convert decrypted number back to 32-byte key
    └─> Result: AES decryption key
    ↓
[3. IPFS Download]
    ├─> Retrieve CID from contract metadata
    ├─> Download encrypted blob from IPFS
    └─> Result: Encrypted data blob
    ↓
[4. AES Decryption]
    ├─> Decrypt blob with AES key
    └─> Result: Original user data
```

### Vault Unlock Flow (Heir)

```
Heir Request
    ↓
[1. Verify Authorization]
    ├─> Check authorizedHeirs mapping
    ├─> Verify releaseTimestamp has passed
    └─> Result: Authorization confirmed
    ↓
[2. Retrieve Encrypted Key]
    ├─> Call getEncryptedKey() on contract
    ├─> Contract verifies ACL permission
    └─> Result: FHE-encrypted key (euint256)
    ↓
[3. FHE Decryption]
    ├─> Use FHEVM SDK to decrypt (ACL enforced)
    ├─> Convert to 32-byte AES key
    └─> Result: AES decryption key
    ↓
[4. IPFS Download]
    ├─> Retrieve CID from contract
    ├─> Download encrypted blob from IPFS
    └─> Result: Encrypted data blob
    ↓
[5. AES Decryption]
    ├─> Decrypt with AES key
    └─> Result: Original user data
```

## Service Layer Architecture

### fheVaultService.ts

**Purpose**: Main orchestration service for vault operations

**Key Functions**:
- `createVault()`: Complete vault creation flow
- `unlockVault()`: Complete unlock flow for owners
- `unlockVaultAsHeir()`: Complete unlock flow for heirs

**Dependencies**:
- `ipfsService.ts`: IPFS operations
- `vaultContractService.ts`: Contract interactions
- `encryption.ts`: AES encryption
- `fheUtils.ts`: FHE key conversion

### ipfsService.ts

**Purpose**: IPFS network interactions

**Key Functions**:
- `uploadToIPFS()`: Upload encrypted data
- `downloadFromIPFS()`: Download encrypted data
- `getIPFSMetadata()`: Retrieve file metadata

**Implementation**:
- Uses IPFS HTTP client
- Handles CID generation
- Manages upload progress

### vaultContractService.ts

**Purpose**: Smart contract interactions

**Key Functions**:
- `createVault()`: Create vault on-chain
- `grantAccess()`: Grant heir access
- `revokeAccess()`: Revoke heir access
- `getVaultMetadata()`: Retrieve vault information
- `getEncryptedKey()`: Retrieve FHE-encrypted key
- `extendVaultReleaseTime()`: Modify release schedule

**Implementation**:
- Uses ethers.js for contract interaction
- Handles transaction signing
- Manages gas estimation

## Utility Functions

### encryption.ts

**AES-256-GCM Implementation**:
```typescript
// Encryption
async function encryptAES(data: string | File, key: Uint8Array): Promise<ArrayBuffer>

// Decryption
async function decryptAES(encryptedData: ArrayBuffer, key: Uint8Array): Promise<string | File>
```

**Key Features**:
- Web Crypto API implementation
- Supports both text and file encryption
- Authenticated encryption (GCM mode)
- IV (Initialization Vector) generation

### fheUtils.ts

**Key Conversion Functions**:
```typescript
// Convert 32-byte key to number for FHE
function bytesToNumber(bytes: Uint8Array): bigint

// Convert number back to 32-byte key
function numberToBytes(num: bigint): Uint8Array
```

**Purpose**: Bridge between AES keys (bytes) and FHE encryption (numbers)

## Configuration Files

### wagmi.ts

**Purpose**: Wallet connection configuration

**Configuration**:
- Supported chains (Sepolia, Hardhat)
- Wallet connectors (MetaMask, WalletConnect)
- Chain RPC endpoints
- Contract addresses

### tailwind.config.js

**Purpose**: Styling configuration

**Custom Configuration**:
- Primary color: `#f9ce10` (yellow)
- Background colors: Light and dark themes
- Font families: Space Grotesk (display), Space Mono (mono)
- Border radius values

## Dependencies

### Frontend Dependencies

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **RainbowKit**: Wallet connection UI
- **wagmi**: Ethereum React hooks
- **ethers.js**: Ethereum library
- **@fhevm-sdk**: FHEVM SDK for React

### Smart Contract Dependencies

- **Hardhat**: Development environment
- **@fhevm/solidity**: FHE Solidity library
- **@fhevm/hardhat-plugin**: Hardhat FHE plugin
- **ethers.js**: Contract interaction

## File Organization Principles

1. **Separation of Concerns**: Services handle business logic, components handle UI
2. **Reusability**: Utilities and hooks are shared across components
3. **Type Safety**: TypeScript types defined in dedicated files
4. **Configuration**: All config in dedicated config files
5. **Testing**: Tests mirror source structure

## Integration Points

### Frontend ↔ Smart Contract
- **Interface**: `vaultContractService.ts`
- **Protocol**: Ethereum JSON-RPC
- **Library**: ethers.js

### Frontend ↔ IPFS
- **Interface**: `ipfsService.ts`
- **Protocol**: IPFS HTTP API
- **Library**: IPFS HTTP client

### Frontend ↔ FHEVM
- **Interface**: `fheVaultService.ts`, `useFheVault.ts`
- **Protocol**: FHEVM SDK
- **Library**: @fhevm-sdk

### Smart Contract ↔ FHEVM
- **Interface**: FHE Solidity library
- **Protocol**: FHEVM on-chain execution
- **Library**: @fhevm/solidity

---

*Next: [Architecture](./architecture.md) | [Developer Guide](./developer-guide.md)*

