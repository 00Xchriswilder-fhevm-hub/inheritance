import { Vault } from '../types';

// In a real app, this would be a smart contract interaction.
// Here we use localStorage to simulate persistence.

const STORAGE_KEY = 'legacy_vaults';

export const getVaults = (): Vault[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveVault = (vault: Vault): void => {
    const vaults = getVaults();
    vaults.push(vault);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
};

export const updateVault = (updatedVault: Vault): void => {
    const vaults = getVaults();
    const index = vaults.findIndex(v => v.id === updatedVault.id);
    if (index !== -1) {
        vaults[index] = updatedVault;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
    }
};

export const getVaultById = (id: string | number): Vault | undefined => {
    const vaults = getVaults();
    return vaults.find(v => String(v.id) === String(id));
};

export const generateVaultId = (): number => {
    return Math.floor(100000 + Math.random() * 900000);
};

// Simple mock encryption/hashing for demonstration
// In production, use crypto.subtle or ethers.js utilities
export const mockHash = async (text: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const mockEncrypt = (text: string, pass: string): string => {
    // This is a dummy encryption for demo purposes. 
    // REAL APP MUST USE AES-GCM
    return btoa(text + ":::" + pass); 
};

export const mockDecrypt = (encrypted: string, pass: string): string | null => {
    try {
        const decoded = atob(encrypted);
        const [text, p] = decoded.split(":::");
        if (p === pass) return text;
        return null;
    } catch (e) {
        return null;
    }
};