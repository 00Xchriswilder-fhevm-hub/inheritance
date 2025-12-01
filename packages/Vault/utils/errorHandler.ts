/**
 * Error Handler Utility
 * Provides user-friendly error messages for transaction failures
 */

export interface TransactionError {
    message: string;
    code?: string | number;
    data?: any;
    reason?: string;
}

/**
 * Parse transaction error and return user-friendly message
 */
export function getTransactionErrorMessage(error: any): string {
    if (!error) {
        return 'An unknown error occurred';
    }

    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || error?.error?.code;
    const errorReason = error?.reason || error?.error?.reason || '';
    const errorData = error?.data || error?.error?.data;

    // User rejected transaction
    if (
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied') ||
        errorMessage.toLowerCase().includes('rejected') ||
        errorCode === 4001 ||
        errorCode === 'ACTION_REJECTED' ||
        errorReason === 'rejected'
    ) {
        return 'Transaction was cancelled. Please approve the transaction in your wallet to continue.';
    }

    // Network errors
    if (
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorCode === 'NETWORK_ERROR'
    ) {
        return 'Network error. Please check your internet connection and try again.';
    }

    // Gas estimation failures
    if (
        errorMessage.toLowerCase().includes('gas') ||
        errorMessage.toLowerCase().includes('insufficient funds') ||
        errorMessage.toLowerCase().includes('execution reverted')
    ) {
        // Try to extract revert reason
        let revertReason = 'Transaction would fail';
        
        if (errorData) {
            // Try to decode revert reason from error data
            try {
                if (typeof errorData === 'string' && errorData.includes('0x')) {
                    // This might be encoded error data
                    if (errorData.includes('Vault does not exist')) {
                        revertReason = 'Vault does not exist';
                    } else if (errorData.includes('Only owner')) {
                        revertReason = 'Only the vault owner can perform this action';
                    } else if (errorData.includes('Cannot grant access after release')) {
                        revertReason = 'Cannot grant access after the release time has passed';
                    } else if (errorData.includes('Cannot revoke after release')) {
                        revertReason = 'Cannot revoke access after the release time has passed';
                    } else if (errorData.includes('Invalid heir address')) {
                        revertReason = 'Invalid heir address provided';
                    } else if (errorData.includes('Cannot grant access to yourself')) {
                        revertReason = 'You cannot grant access to your own address';
                    } else if (errorData.includes('Vault ID already exists')) {
                        revertReason = 'A vault with this ID already exists';
                    } else if (errorData.includes('Must be future timestamp')) {
                        revertReason = 'Release time must be in the future';
                    }
                }
            } catch (e) {
                // Ignore decoding errors
            }
        }

        // Check error message for common patterns
        if (errorMessage.includes('Vault does not exist')) {
            revertReason = 'Vault does not exist';
        } else if (errorMessage.includes('Only owner')) {
            revertReason = 'Only the vault owner can perform this action';
        } else if (errorMessage.includes('Cannot grant access after release')) {
            revertReason = 'Cannot grant access after the release time has passed';
        } else if (errorMessage.includes('Cannot revoke after release')) {
            revertReason = 'Cannot revoke access after the release time has passed';
        } else if (errorMessage.includes('Invalid heir address')) {
            revertReason = 'Invalid heir address provided';
        } else if (errorMessage.includes('Cannot grant access to yourself')) {
            revertReason = 'You cannot grant access to your own address';
        } else if (errorMessage.includes('Vault ID already exists') || errorMessage.includes('already exists')) {
            revertReason = 'A vault with this ID already exists';
        } else if (errorMessage.includes('Must be future timestamp')) {
            revertReason = 'Release time must be in the future';
        } else if (errorMessage.includes('insufficient funds')) {
            revertReason = 'Insufficient funds for gas. Please add more ETH to your wallet.';
        }

        return `${revertReason}. Please check your inputs and try again.`;
    }

    // Contract-specific errors
    if (errorMessage.includes('execution reverted')) {
        // Try to extract the revert reason
        const revertMatch = errorMessage.match(/execution reverted: (.+)/);
        if (revertMatch && revertMatch[1]) {
            return `Transaction failed: ${revertMatch[1]}`;
        }
        return 'Transaction failed. The contract rejected the transaction. Please check your inputs.';
    }

    // Wallet not connected
    if (
        errorMessage.toLowerCase().includes('wallet') ||
        errorMessage.toLowerCase().includes('not connected') ||
        errorMessage.toLowerCase().includes('no signer')
    ) {
        return 'Please connect your wallet and try again.';
    }

    // Provider errors
    if (
        errorMessage.toLowerCase().includes('provider') ||
        errorMessage.toLowerCase().includes('ethereum')
    ) {
        return 'Wallet connection error. Please refresh the page and reconnect your wallet.';
    }

    // Return original message if it's already user-friendly, otherwise generic message
    if (errorMessage.length < 200 && !errorMessage.includes('0x')) {
        return errorMessage;
    }

    return 'Transaction failed. Please try again or contact support if the problem persists.';
}

/**
 * Check if error is a user rejection
 */
export function isUserRejection(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || error?.error?.code;
    const errorReason = error?.reason || error?.error?.reason || '';

    return (
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied') ||
        errorMessage.toLowerCase().includes('rejected') ||
        errorCode === 4001 ||
        errorCode === 'ACTION_REJECTED' ||
        errorReason === 'rejected'
    );
}

