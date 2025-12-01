# FHE Vault Contract Design Discussion

## Current State Analysis

### Your TEN Protocol Vault (LegacyVaultTEN_DAO)
- **Encryption**: Client-side AES-256-GCM encryption
- **Storage**: Encrypted data stored directly on-chain as `bytes`
- **Access Control**: Key hash verification (ownerKeyHash, heirKeyHash)
- **Time-lock**: Block timestamp-based release
- **Data**: Can store any bytes (text, PDFs, etc.)

### Reference FHE Contract (FHEIPFSStorage)
- **Encryption**: FHEVM fully homomorphic encryption
- **Storage**: Files on IPFS, encrypted keys on-chain with FHE
- **Access Control**: Zama ACL system (`FHE.allow()`)
- **Data Type**: Limited to encrypted numeric types (euint128 for keys)

## Key Design Decisions

### 1. **IPFS vs On-Chain Storage**

**Option A: Use IPFS (Recommended)**
- ✅ **Pros**:
  - Can store large files (PDFs, text files)
  - Lower gas costs (only store encrypted keys on-chain)
  - FHE is designed for numeric operations, not large text storage
  - Matches the reference contract pattern
  
- ❌ **Cons**:
  - Requires IPFS infrastructure
  - Files stored off-chain (but encrypted)

**Option B: Pure On-Chain**
- ✅ **Pros**:
  - Fully decentralized
  - No external dependencies
  
- ❌ **Cons**:
  - FHE only supports numeric types (euint32, euint128)
  - Cannot directly encrypt text/phrases with FHE
  - Very expensive for large data
  - Would need to convert text to numbers (impractical)

**Recommendation**: Use IPFS for encrypted file storage, store FHE-encrypted decryption keys on-chain.

### 2. **Encryption Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    Client-Side Process                   │
├─────────────────────────────────────────────────────────┤
│ 1. User provides: mnemonic/phrase/text/file             │
│ 2. Generate AES-256-GCM encryption key (random)          │
│ 3. Encrypt data with AES key → encryptedData            │
│ 4. Upload encryptedData to IPFS → get CID               │
│ 5. Encrypt AES key with FHE → euint128 encryptedKey     │
│ 6. Store on-chain: CID + encryptedKey + metadata        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    On-Chain Storage                       │
├─────────────────────────────────────────────────────────┤
│ struct Vault {                                           │
│   string cid;              // IPFS CID                   │
│   euint128 encryptedKey;   // FHE-encrypted AES key      │
│   uint256 releaseTimestamp; // Time-lock                 │
│   address owner;           // Creator                    │
│   mapping(address => bool) authorizedHeirs; // ACL        │
│ }                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Decryption Process                     │
├─────────────────────────────────────────────────────────┤
│ 1. Heir calls getEncryptedKey(vaultId)                   │
│ 2. Contract checks:                                      │
│    - block.timestamp >= releaseTimestamp                 │
│    - FHE.allow() grants access to heir                  │
│ 3. Returns euint128 encryptedKey                         │
│ 4. Frontend uses FHEVM SDK to decrypt → AES key         │
│ 5. Download encryptedData from IPFS using CID            │
│ 6. Decrypt encryptedData with AES key → original data    │
└─────────────────────────────────────────────────────────┘
```

### 3. **Access Control with FHE ACL**

FHE's Access Control List (ACL) system is perfect for your use case:

```solidity
// When creating vault
FHE.allowThis(encryptedKey);  // Contract can access
FHE.allow(encryptedKey, owner); // Owner can decrypt

// When granting access to heir
function grantAccess(uint256 vaultId, address heir) external {
    require(vaults[vaultId].owner == msg.sender, "Not owner");
    require(block.timestamp < vaults[vaultId].releaseTimestamp, "Already released");
    
    FHE.allow(vaults[vaultId].encryptedKey, heir);
    authorizedHeirs[vaultId][heir] = true;
}

// When revoking access
function revokeAccess(uint256 vaultId, address heir) external {
    require(vaults[vaultId].owner == msg.sender, "Not owner");
    // Note: FHE ACL doesn't support direct revocation
    // We track in mapping and check before allowing decryption
    authorizedHeirs[vaultId][heir] = false;
}
```

### 4. **Time-Lock Implementation**

```solidity
function getEncryptedKey(uint256 vaultId) external view returns (euint128) {
    Vault storage vault = vaults[vaultId];
    require(vault.owner != address(0), "Vault does not exist");
    require(block.timestamp >= vault.releaseTimestamp, "Too early");
    require(
        vault.owner == msg.sender || authorizedHeirs[vaultId][msg.sender],
        "Not authorized"
    );
    // FHE.allow() check happens automatically by Zama framework
    return vault.encryptedKey;
}
```

## Proposed Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, externalEuint128} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHELegacyVault is SepoliaConfig {
    struct Vault {
        string cid;                    // IPFS CID of encrypted data
        euint128 encryptedKey;         // FHE-encrypted AES decryption key
        uint256 releaseTimestamp;      // When heirs can access
        address owner;                 // Vault creator
        uint256 createdAt;             // Creation timestamp
        bool exists;                   // Vault existence flag
    }
    
    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => mapping(address => bool)) public authorizedHeirs;
    mapping(address => uint256[]) private userVaults;
    
    uint256 public vaultCounter;
    
    event VaultCreated(uint256 indexed vaultId, address indexed owner, string cid, uint256 releaseTimestamp);
    event AccessGranted(uint256 indexed vaultId, address indexed heir);
    event AccessRevoked(uint256 indexed vaultId, address indexed heir);
    event ReleaseTimeExtended(uint256 indexed vaultId, uint256 newTimestamp);
    
    // Create vault with encrypted data on IPFS
    function createVault(
        string calldata _cid,
        externalEuint128 _encryptedKey,
        bytes calldata _inputProof,
        uint256 _releaseTimestamp
    ) external {
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(_releaseTimestamp > block.timestamp, "Release time must be in future");
        
        vaultCounter++;
        uint256 vaultId = vaultCounter;
        
        // Convert external encrypted key to internal format
        euint128 encryptedKey = FHE.fromExternal(_encryptedKey, _inputProof);
        
        vaults[vaultId] = Vault({
            cid: _cid,
            encryptedKey: encryptedKey,
            releaseTimestamp: _releaseTimestamp,
            owner: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });
        
        userVaults[msg.sender].push(vaultId);
        
        // Set up ACL: contract and owner can access
        FHE.allowThis(encryptedKey);
        FHE.allow(encryptedKey, msg.sender);
        
        emit VaultCreated(vaultId, msg.sender, _cid, _releaseTimestamp);
    }
    
    // Grant access to heir (only before release time)
    function grantAccess(uint256 _vaultId, address _heir) external {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        require(vault.owner == msg.sender, "Only owner can grant access");
        require(block.timestamp < vault.releaseTimestamp, "Cannot grant access after release");
        require(_heir != address(0), "Invalid heir address");
        require(_heir != msg.sender, "Cannot grant access to yourself");
        
        // Grant FHE ACL permission
        FHE.allow(vault.encryptedKey, _heir);
        authorizedHeirs[_vaultId][_heir] = true;
        
        emit AccessGranted(_vaultId, _heir);
    }
    
    // Revoke access (track in mapping, FHE ACL doesn't support direct revocation)
    function revokeAccess(uint256 _vaultId, address _heir) external {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        require(vault.owner == msg.sender, "Only owner can revoke access");
        require(block.timestamp < vault.releaseTimestamp, "Cannot revoke after release");
        
        authorizedHeirs[_vaultId][_heir] = false;
        emit AccessRevoked(_vaultId, _heir);
    }
    
    // Get encrypted key (only after release time and if authorized)
    function getEncryptedKey(uint256 _vaultId) external view returns (euint128) {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        require(
            block.timestamp >= vault.releaseTimestamp,
            "Release time not reached"
        );
        require(
            vault.owner == msg.sender || authorizedHeirs[_vaultId][msg.sender],
            "Not authorized"
        );
        // FHE.allow() check is enforced by Zama framework
        return vault.encryptedKey;
    }
    
    // Owner can always access (before or after release)
    function getEncryptedKeyAsOwner(uint256 _vaultId) external view returns (euint128) {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        require(vault.owner == msg.sender, "Only owner can access");
        return vault.encryptedKey;
    }
    
    // Extend release time
    function extendReleaseTime(uint256 _vaultId, uint256 _newTimestamp) external {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        require(vault.owner == msg.sender, "Only owner can extend");
        require(_newTimestamp > vault.releaseTimestamp, "Must be future timestamp");
        
        vault.releaseTimestamp = _newTimestamp;
        emit ReleaseTimeExtended(_vaultId, _newTimestamp);
    }
    
    // Get vault metadata (public info)
    function getVaultMetadata(uint256 _vaultId) external view returns (
        address owner,
        string memory cid,
        uint256 releaseTimestamp,
        uint256 createdAt
    ) {
        Vault storage vault = vaults[_vaultId];
        require(vault.exists, "Vault does not exist");
        return (
            vault.owner,
            vault.cid,
            vault.releaseTimestamp,
            vault.createdAt
        );
    }
    
    // Get user's vaults
    function getUserVaults(address _user) external view returns (uint256[] memory) {
        return userVaults[_user];
    }
    
    // Check if address is authorized for vault
    function isAuthorized(uint256 _vaultId, address _address) external view returns (bool) {
        Vault storage vault = vaults[_vaultId];
        if (!vault.exists) return false;
        if (vault.owner == _address) return true;
        if (block.timestamp < vault.releaseTimestamp) return false;
        return authorizedHeirs[_vaultId][_address];
    }
}
```

## Frontend Integration Flow

### Creating a Vault:
1. User enters mnemonic/phrase or uploads file
2. Generate random AES-256-GCM key
3. Encrypt data with AES key
4. Upload encrypted data to IPFS → get CID
5. Use FHEVM SDK to encrypt AES key → `externalEuint128`
6. Call `createVault(cid, encryptedKey, proof, releaseTimestamp)`

### Accessing as Heir:
1. Check `getVaultMetadata(vaultId)` to verify release time
2. Call `getEncryptedKey(vaultId)` → returns `euint128`
3. Use FHEVM SDK to decrypt → get AES key
4. Download encrypted data from IPFS using CID
5. Decrypt data with AES key → original mnemonic/phrase

## Key Differences from TEN Protocol

| Feature | TEN Protocol | FHE Approach |
|---------|-------------|-------------|
| **Data Storage** | On-chain bytes | IPFS (encrypted) |
| **Key Storage** | Key hashes | FHE-encrypted keys |
| **Access Control** | Hash verification | FHE ACL system |
| **Decryption** | Client-side only | FHEVM relayer |
| **Privacy** | Data visible on-chain | Data encrypted, keys encrypted |
| **Gas Costs** | Higher (on-chain data) | Lower (only keys on-chain) |

## Next Steps

1. ✅ Fix MetaMask connector (done)
2. Set up IPFS client (Pinata, Infura, or local node)
3. Implement encryption utilities (AES-256-GCM + FHE)
4. Write the FHE contract
5. Create frontend integration with FHEVM SDK
6. Test on Sepolia testnet

