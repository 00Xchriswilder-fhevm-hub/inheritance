# Smart Contract Architecture

This document provides a comprehensive overview of the Legacy Vault smart contract architecture, including data structures, functions, and access control mechanisms.

## Contract Overview

**Contract Name**: `FHELegacyVault`  
**Network**: Sepolia Testnet (Ethereum)  
**Language**: Solidity 0.8.24  
**FHE Library**: ZAMA FHEVM (`@fhevm/solidity`)

## Core Data Structures

### Vault Struct

```solidity
struct Vault {
    string cid;                    // IPFS Content Identifier
    euint256 encryptedKey;         // FHE-encrypted AES decryption key
    uint256 releaseTimestamp;      // When heirs can access (Unix timestamp)
    address owner;                 // Vault creator address
    uint256 createdAt;             // Creation timestamp
}
```

**Fields Explanation**:
- `cid`: IPFS Content Identifier pointing to encrypted file/data
- `encryptedKey`: AES decryption key encrypted with FHE (euint256)
- `releaseTimestamp`: Unix timestamp when heirs can access
- `owner`: Ethereum address of vault creator
- `createdAt`: Unix timestamp of vault creation

### Storage Mappings

```solidity
mapping(string => Vault) public vaults;                    // vaultId => Vault
mapping(address => string[]) public userVaults;            // owner => vaultIds[]
mapping(string => mapping(address => bool)) public authorizedHeirs;  // vaultId => heir => authorized
mapping(string => bool) public vaultExists;                // vaultId => exists
```

**Mappings Explanation**:
- `vaults`: Primary storage for all vault data
- `userVaults`: Index of vault IDs per owner address
- `authorizedHeirs`: Access control list for each vault
- `vaultExists`: Quick lookup for vault existence

## Core Functions

### Vault Creation

#### `createVault()`

```solidity
function createVault(
    string memory vaultId,
    string memory cid,
    euint256 encryptedKey,
    bytes memory inputProof,
    uint256 releaseTimestamp
) public returns (bool)
```

**Parameters**:
- `vaultId`: Unique identifier for the vault
- `cid`: IPFS Content Identifier
- `encryptedKey`: FHE-encrypted AES key
- `inputProof`: FHE input proof for verification
- `releaseTimestamp`: Release time (Unix timestamp)

**Process**:
1. Validates vault ID is not empty
2. Checks vault doesn't already exist
3. Validates release timestamp is in future
4. Creates vault struct with provided data
5. Grants owner access via FHE ACL: `FHE.allow(encryptedKey, msg.sender)`
6. Stores vault in mappings
7. Emits `VaultCreated` event

**Access Control**:
- Public function (anyone can create)
- Owner automatically gets FHE ACL permission

**Events**:
```solidity
event VaultCreated(string indexed vaultId, address indexed owner, uint256 releaseTimestamp);
```

### Access Management

#### `grantAccess()`

```solidity
function grantAccess(string memory vaultId, address heir) public
```

**Parameters**:
- `vaultId`: Vault identifier
- `heir`: Address to grant access to

**Process**:
1. Verifies caller is vault owner
2. Checks release time hasn't passed
3. Grants FHE ACL permission: `FHE.allow(vaults[vaultId].encryptedKey, heir)`
4. Updates `authorizedHeirs` mapping
5. Emits `AccessGranted` event

**Access Control**:
- Only vault owner can call
- Must be called before release time

**Events**:
```solidity
event AccessGranted(string indexed vaultId, address indexed heir);
```

#### `grantAccessToMultiple()`

```solidity
function grantAccessToMultiple(string memory vaultId, address[] memory heirs) public
```

**Parameters**:
- `vaultId`: Vault identifier
- `heirs`: Array of addresses to grant access to

**Process**:
- Batch version of `grantAccess()`
- Grants access to multiple heirs in single transaction
- More gas-efficient for multiple heirs

#### `revokeAccess()`

```solidity
function revokeAccess(string memory vaultId, address heir) public
```

**Parameters**:
- `vaultId`: Vault identifier
- `heir`: Address to revoke access from

**Process**:
1. Verifies caller is vault owner
2. Checks release time hasn't passed
3. Removes FHE ACL permission: `FHE.remove(vaults[vaultId].encryptedKey, heir)`
4. Updates `authorizedHeirs` mapping
5. Emits `AccessRevoked` event

**Access Control**:
- Only vault owner can call
- Must be called before release time

**Events**:
```solidity
event AccessRevoked(string indexed vaultId, address indexed heir);
```

### Key Retrieval

#### `getEncryptedKeyAsOwner()`

```solidity
function getEncryptedKeyAsOwner(string memory vaultId) 
    public 
    view 
    returns (euint256)
```

**Parameters**:
- `vaultId`: Vault identifier

**Returns**: FHE-encrypted key (euint256)

**Process**:
1. Verifies caller is vault owner
2. Returns encrypted key
3. Owner can decrypt using FHEVM SDK

**Access Control**:
- Only vault owner can call
- No time restrictions (owner can always access)

#### `getEncryptedKey()`

```solidity
function getEncryptedKey(string memory vaultId) 
    public 
    view 
    returns (euint256)
```

**Parameters**:
- `vaultId`: Vault identifier

**Returns**: FHE-encrypted key (euint256)

**Process**:
1. Verifies caller is authorized heir
2. Verifies release time has passed
3. Returns encrypted key
4. Heir can decrypt using FHEVM SDK

**Access Control**:
- Only authorized heirs can call
- Requires release time to have passed
- FHE ACL enforces permissions

### Metadata Retrieval

#### `getVaultMetadata()`

```solidity
function getVaultMetadata(string memory vaultId)
    public
    view
    returns (VaultMetadata memory)
```

**Returns**:
```solidity
struct VaultMetadata {
    address owner;
    string cid;
    uint256 releaseTimestamp;
    uint256 createdAt;
}
```

**Process**:
- Public function (anyone can query)
- Returns non-sensitive vault information
- Does not expose encrypted key

#### `getUserVaults()`

```solidity
function getUserVaults(address user) 
    public 
    view 
    returns (string[] memory)
```

**Returns**: Array of vault IDs owned by user

**Process**:
- Public function
- Returns all vault IDs for given address
- Used for vault listing

#### `getHeirVaults()`

```solidity
function getHeirVaults(address heir) 
    public 
    view 
    returns (string[] memory)
```

**Returns**: Array of vault IDs where user is authorized heir

**Process**:
- Public function
- Iterates through all vaults
- Returns vaults where user is authorized heir
- Used for heir vault listing

### Release Time Management

#### `extendVaultReleaseTime()`

```solidity
function extendVaultReleaseTime(
    string memory vaultId,
    uint256 newReleaseTimestamp
) public
```

**Parameters**:
- `vaultId`: Vault identifier
- `newReleaseTimestamp`: New release time (Unix timestamp)

**Process**:
1. Verifies caller is vault owner
2. Validates new timestamp is in future
3. Updates `releaseTimestamp` in vault struct
4. Emits `ReleaseTimeUpdated` event

**Access Control**:
- Only vault owner can call
- Can be called anytime

**Events**:
```solidity
event ReleaseTimeUpdated(string indexed vaultId, uint256 newReleaseTimestamp);
```

## FHE Access Control List (ACL)

### How FHE ACL Works

The contract uses ZAMA FHEVM's Access Control List system to manage permissions:

1. **Encryption**: AES key is encrypted as `euint256` (encrypted uint256)
2. **Permission Granting**: `FHE.allow(encryptedKey, address)` grants access
3. **Permission Removal**: `FHE.remove(encryptedKey, address)` revokes access
4. **Decryption**: Only authorized addresses can decrypt via FHEVM SDK

### ACL Lifecycle

```
Vault Creation:
  └─> FHE.allow(encryptedKey, owner)  // Owner gets access

Grant Heir Access:
  └─> FHE.allow(encryptedKey, heir)   // Heir gets access

Revoke Heir Access:
  └─> FHE.remove(encryptedKey, heir)   // Heir loses access
```

### Security Properties

- **Cryptographic Enforcement**: ACL is enforced by FHEVM, not contract logic
- **Cannot Bypass**: Even contract owner cannot bypass ACL
- **Transparent**: ACL permissions are on-chain
- **Revocable**: Owner can revoke before release time

## Access Control Rules

### Owner Access
- ✅ Can access vault **anytime** (no time restriction)
- ✅ Can grant/revoke heir access
- ✅ Can modify release time
- ✅ Can view all vault metadata

### Heir Access
- ✅ Can access vault **only after** release time
- ❌ Cannot access before release time
- ❌ Cannot grant access to others
- ❌ Cannot modify release time
- ✅ Can view vault metadata (if authorized)

### Public Access
- ✅ Can view vault metadata (owner, CID, timestamps)
- ❌ Cannot view encrypted key
- ❌ Cannot decrypt vault
- ❌ Cannot modify vault

## Events

All contract events for tracking and monitoring:

```solidity
event VaultCreated(
    string indexed vaultId,
    address indexed owner,
    uint256 releaseTimestamp
);

event AccessGranted(
    string indexed vaultId,
    address indexed heir
);

event AccessRevoked(
    string indexed vaultId,
    address indexed heir
);

event ReleaseTimeUpdated(
    string indexed vaultId,
    uint256 newReleaseTimestamp
);
```

## Gas Optimization

### Current Optimizations
- **Packed Structs**: Vault struct uses efficient storage
- **Indexed Events**: Events use indexed parameters for filtering
- **Batch Operations**: `grantAccessToMultiple()` reduces gas costs
- **View Functions**: Metadata queries are view functions (no gas)

### Gas Costs (Approximate)
- `createVault()`: ~200,000 - 300,000 gas
- `grantAccess()`: ~100,000 - 150,000 gas
- `grantAccessToMultiple()`: ~150,000 + (50,000 × n) gas
- `revokeAccess()`: ~80,000 - 120,000 gas
- `extendVaultReleaseTime()`: ~50,000 - 80,000 gas
- View functions: 0 gas (free)

## Security Considerations

### Input Validation
- ✅ Vault ID cannot be empty
- ✅ Vault ID must be unique
- ✅ Release timestamp must be in future
- ✅ Heir address cannot be zero address

### Access Control
- ✅ Owner verification on all write operations
- ✅ Release time enforcement for heirs
- ✅ FHE ACL cryptographic enforcement
- ✅ No unauthorized access possible

### Edge Cases
- ✅ Prevents duplicate vault creation
- ✅ Handles non-existent vault queries
- ✅ Validates timestamp constraints
- ✅ Prevents access after release time modification

## Contract Deployment

### Deployment Process
1. Compile contract with Hardhat
2. Deploy to network (Sepolia/Hardhat)
3. Verify contract on Etherscan
4. Update frontend with contract address

### Network Configuration
- **Sepolia Testnet**: Main deployment
- **Hardhat Local**: Development/testing
- **Future**: Multi-chain deployment planned

## Contract Addresses

### Current Deployments
- **Sepolia**: `[Contract Address]`
- **Hardhat Local**: Deployed per instance

### Verification
- Contracts verified on Etherscan
- Source code publicly available
- ABI available for integration

## Integration Guide

### Frontend Integration
See [Developer Guide](./developer-guide.md) for:
- Contract interaction patterns
- FHEVM SDK usage
- Error handling
- Best practices

### SDK Usage
```typescript
// Example: Create vault
const vaultId = generateVaultId();
const encryptedKey = await fhevm.encrypt(aesKey);
await contract.createVault(
    vaultId,
    ipfsCid,
    encryptedKey,
    inputProof,
    releaseTimestamp
);
```

---

*Next: [Architecture](./architecture.md) | [Developer Guide](./developer-guide.md)*

