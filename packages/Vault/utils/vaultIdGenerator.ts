/**
 * Generate random alphanumeric vault ID
 * Format: lowercase letters and numbers, 7 characters (e.g., "x5gsyts")
 */
export function generateVaultId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // First character must be a letter
    result += chars.charAt(Math.floor(Math.random() * 26));
    
    // Remaining 6 characters can be any alphanumeric
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Validate vault ID format
 */
export function isValidVaultId(id: string): boolean {
    return /^[a-z][a-z0-9]{6}$/.test(id);
}

