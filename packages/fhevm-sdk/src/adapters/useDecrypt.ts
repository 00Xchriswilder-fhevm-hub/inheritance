/**
 * Wagmi-like hook for decryption operations
 * User decryption only (EIP-712 signed decryption)
 */

import { useState, useCallback } from 'react';
import { decryptValue, batchDecryptValues } from '../core/index.js';

export function useDecrypt() {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string>('');

  const decrypt = useCallback(async (handle: string, contractAddress: string, signer: any) => {
    setIsDecrypting(true);
    setError('');
    
    try {
      const result = await decryptValue(handle, contractAddress, signer);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed');
      throw err;
    } finally {
      setIsDecrypting(false);
    }
  }, []);

  const decryptMultiple = useCallback(async (contractAddress: string, signer: any, handles: string[]) => {
    setIsDecrypting(true);
    setError('');
    
    try {
      const result = await batchDecryptValues(handles, contractAddress, signer);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Multiple decryption failed');
      throw err;
    } finally {
      setIsDecrypting(false);
    }
  }, []);

  return {
    decrypt,
    decryptMultiple,
    isDecrypting,
    error,
  };
}
