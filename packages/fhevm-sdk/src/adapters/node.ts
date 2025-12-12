/**
 * Node.js Adapter - Universal FHEVM SDK
 * Real server-side FHEVM operations with RPC and private key support
 */

import { 
  initializeFheInstance, 
  getFheInstance, 
  decryptValue,
  createEncryptedInput,
  batchDecryptValues
} from '../core/index.js';
import { ethers } from 'ethers';

export interface FhevmNodeOptions {
  rpcUrl?: string;
  privateKey?: string;
  chainId?: number;
}

/**
 * Enhanced Node.js FHEVM manager with server-side capabilities
 */
export class FhevmNode {
  private instance: any = null;
  private isReady = false;
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private options: FhevmNodeOptions;

  constructor(options: FhevmNodeOptions = {}) {
    this.options = {
      rpcUrl: options.rpcUrl || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      chainId: options.chainId || 11155111, // Sepolia
      ...options
    };
  }

  async initialize() {
    try {
      console.log('🚀 Initializing FHEVM Node.js instance...');
      console.warn('⚠️ Note: FHEVM SDK now only supports browser environments. Node.js initialization will fail.');
      
      // Browser-only SDK - Node.js is not supported
      throw new Error('FHEVM SDK only supports browser environments. Node.js initialization is not available. Use browser-based initialization instead.');
    } catch (error) {
      console.error('❌ FHEVM Node initialization failed:', error);
      throw error;
    }
  }

  async encrypt(contractAddress: string, userAddress: string, value: number) {
    if (!this.isReady) throw new Error('FHEVM not initialized');
    console.log(`🔐 Encrypting value ${value} for contract ${contractAddress}, user ${userAddress}`);
    return createEncryptedInput(contractAddress, userAddress, value);
  }

  async decrypt(handle: string, contractAddress: string, signer?: any) {
    if (!this.isReady) throw new Error('FHEVM not initialized');
    
    // Use provided signer or default wallet
    const signerToUse = signer || this.wallet;
    if (!signerToUse) {
      throw new Error('No signer available. Provide a signer or initialize with privateKey');
    }
    
    console.log(`🔓 Decrypting handle ${handle} for contract ${contractAddress}`);
    return decryptValue(handle, contractAddress, signerToUse);
  }

  async decryptMultiple(contractAddress: string, handles: string[], signer?: any) {
    if (!this.isReady) throw new Error('FHEVM not initialized');
    
    // Use provided signer or default wallet
    const signerToUse = signer || this.wallet;
    if (!signerToUse) {
      throw new Error('No signer available. Provide a signer or initialize with privateKey');
    }
    
    console.log(`🔓 Decrypting ${handles.length} handles for contract ${contractAddress}`);
    return batchDecryptValues(handles, contractAddress, signerToUse);
  }

  /**
   * Create a contract instance for server-side interactions
   */
  createContract(address: string, abi: any[]) {
    if (!this.provider) throw new Error('Provider not initialized');
    if (!this.wallet) throw new Error('Wallet not initialized - provide privateKey');
    
    return new ethers.Contract(address, abi, this.wallet);
  }

  /**
   * Execute encrypted transaction
   * Supports both old format (encryptedData, proof) and new FHEVM 0.9.0 format (handles, inputProof)
   */
  async executeEncryptedTransaction(
    contract: ethers.Contract,
    methodName: string,
    encryptedData: any,
    ...additionalParams: any[]
  ) {
    if (!this.isReady) throw new Error('FHEVM not initialized');
    
    console.log(`📝 Executing encrypted transaction: ${methodName}`);
    
    try {
      // Handle new FHEVM 0.9.0 format (handles array + inputProof)
      let handle: any, proof: any;
      
      if (encryptedData && typeof encryptedData === 'object') {
        if (encryptedData.handles && Array.isArray(encryptedData.handles) && encryptedData.handles.length > 0) {
          // New format: { handles: [Uint8Array], inputProof: Uint8Array }
          handle = encryptedData.handles[0];
          proof = encryptedData.inputProof;
        } else if (encryptedData.encryptedData && encryptedData.proof) {
          // Old format: { encryptedData: any, proof: any }
          handle = encryptedData.encryptedData;
          proof = encryptedData.proof;
        } else {
          // Fallback: assume it's the handle itself
          handle = encryptedData;
          proof = encryptedData;
        }
      } else {
        handle = encryptedData;
        proof = encryptedData;
      }
      
      // Convert Uint8Array to hex string if needed
      if (handle instanceof Uint8Array) {
        handle = ethers.hexlify(handle);
      }
      if (proof instanceof Uint8Array) {
        proof = ethers.hexlify(proof);
      }
      
      const tx = await contract[methodName](
        handle,
        proof,
        ...additionalParams
      );
      
      console.log(`✅ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed: ${receipt?.hash}`);
      
      return receipt;
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  async getAddress(): Promise<string | null> {
    if (!this.wallet) return null;
    return this.wallet.getAddress();
  }

  /**
   * Get provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Get wallet
   */
  getWallet() {
    return this.wallet;
  }

  getInstance() {
    return this.instance;
  }

  getStatus() {
    return this.isReady ? 'ready' : 'idle';
  }

  /**
   * Get configuration info
   */
  getConfig() {
    return {
      rpcUrl: this.options.rpcUrl,
      chainId: this.options.chainId,
      hasWallet: !!this.wallet,
      hasProvider: !!this.provider,
      isReady: this.isReady
    };
  }
}
