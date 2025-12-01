/**
 * Wagmi-like hook for encryption operations
 */

import { useState, useCallback } from 'react';
import { createEncryptedInput } from '../core/index.js';

export function useEncrypt() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<string>('');

  const encrypt = useCallback(async (
    contractAddress: string, 
    userAddress: string, 
    value: number | bigint,
    bitSize: 8 | 16 | 32 | 64 | 128 | 256 = 128 // Default to 128 for euint128
  ) => {
    setIsEncrypting(true);
    setError('');
    
    try {
      const result = await createEncryptedInput(contractAddress, userAddress, value, bitSize);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encryption failed');
      throw err;
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  return {
    encrypt,
    isEncrypting,
    error,
  };
}
