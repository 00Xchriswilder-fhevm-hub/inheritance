# FHE Vault Usage Examples

## Using Wagmi and FHEVM SDK Hooks

This document shows how to use the vault with wagmi and FHEVM SDK hooks, following the React showcase pattern.

## Setup

```typescript
import { useAccount, useWalletClient } from 'wagmi';
import { useFhevm } from '@fhevm-sdk';
import { useFheVault } from './hooks/useFheVault';
import { useVaultContract } from './hooks/useVaultContract';
import { createVault, unlockVault } from './services/fheVaultService';
```

## Component Example

```typescript
import React, { useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useFhevm } from '@fhevm-sdk';
import { useFheVault } from '../hooks/useFheVault';
import { useVaultContract } from '../hooks/useVaultContract';
import { createVault, unlockVault } from '../services/fheVaultService';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS;

function CreateVaultComponent() {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { status: fhevmStatus, initialize } = useFhevm();
    const { encryptValue, decryptValue, getSigner } = useFheVault();
    const { readContract, getWriteContract } = useVaultContract(CONTRACT_ADDRESS);

    // Initialize FHEVM when wallet is connected
    useEffect(() => {
        if (isConnected && fhevmStatus === 'idle') {
            initialize();
        }
    }, [isConnected, fhevmStatus, initialize]);

    const handleCreateVault = async () => {
        if (!isConnected || !walletClient || fhevmStatus !== 'ready') {
            console.error('Not ready');
            return;
        }

        try {
            const signer = await getSigner();
            if (!signer) throw new Error('No signer');

            // Create vault using the service
            const result = await createVault({
                data: 'my secret mnemonic phrase',
                releaseTimestamp: Math.floor(Date.now() / 1000) + 86400, // 1 day
                contractAddress: CONTRACT_ADDRESS,
                signer: signer,
                userAddress: address!,
                encryptFn: encryptValue, // Pass the encrypt function from hook
            });

            console.log('Vault created:', result);
        } catch (error) {
            console.error('Failed to create vault:', error);
        }
    };

    const handleUnlockVault = async (vaultId: number, isOwner: boolean = false) => {
        if (!isConnected || !walletClient || fhevmStatus !== 'ready') {
            console.error('Not ready');
            return;
        }

        try {
            const signer = await getSigner();
            if (!signer) throw new Error('No signer');

            const provider = signer.provider || ethers.getDefaultProvider();

            // Unlock vault using the service
            const decrypted = await unlockVault({
                vaultId: vaultId,
                contractAddress: CONTRACT_ADDRESS,
                provider: provider,
                signer: signer,
                userAddress: address!,
                decryptFn: decryptValue, // Pass the decrypt function from hook
                isOwner: isOwner,
            });

            console.log('Decrypted data:', decrypted);
        } catch (error) {
            console.error('Failed to unlock vault:', error);
        }
    };

    if (!isConnected || fhevmStatus !== 'ready') {
        return <div>Please connect wallet and wait for FHEVM to initialize</div>;
    }

    return (
        <div>
            <button onClick={handleCreateVault}>Create Vault</button>
            <button onClick={() => handleUnlockVault(1, true)}>Unlock as Owner</button>
            <button onClick={() => handleUnlockVault(1, false)}>Unlock as Heir</button>
        </div>
    );
}
```

## Key Points

1. **Initialize FHEVM**: Use `useFhevm()` hook and call `initialize()` when wallet is connected
2. **Use FHE Hooks**: `useFheVault()` provides `encryptValue` and `decryptValue` functions
3. **Use Contract Hook**: `useVaultContract()` provides read/write contract instances
4. **Pass Functions**: The service functions accept `encryptFn` and `decryptFn` as parameters
5. **Wagmi Integration**: Use `useAccount()` and `useWalletClient()` from wagmi

## Available Hooks

### `useFheVault()`
- `encryptValue(contractAddress, value)` - Encrypt a number with FHE
- `decryptValue(handle, contractAddress)` - Decrypt an FHE value
- `getSigner()` - Get ethers signer from wagmi
- `isEncrypting`, `isDecrypting` - Loading states
- `encryptError`, `decryptError` - Error states

### `useVaultContract(contractAddress)`
- `readContract` - Read-only contract instance
- `getWriteContract()` - Get write contract with signer
- `getSigner()` - Get signer
- `isReady` - Contract ready state
- `isConnected`, `address` - Wallet state

## Service Functions

### `createVault(params)`
- Requires `encryptFn` parameter (from `useFheVault().encryptValue`)
- Returns `{ vaultId, cid, aesKey }`

### `unlockVault(params)`
- Requires `decryptFn` parameter (from `useFheVault().decryptValue`)
- Returns decrypted data as string or ArrayBuffer


