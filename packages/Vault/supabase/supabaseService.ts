import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Service
 * Handles database operations for users, vaults, and heirs
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase credentials not configured');
}

const supabase = SUPABASE_URL && SUPABASE_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

/**
 * User table operations
 */
export const userService = {
    /**
     * Create or update user record
     */
    async upsertUser(walletAddress: string, data?: {
        email?: string;
        name?: string;
        createdAt?: Date;
    }) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data: result, error } = await supabase
            .from('users')
            .upsert({
                wallet_address: walletAddress.toLowerCase(),
                email: data?.email,
                name: data?.name,
                created_at: data?.createdAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address'
            })
            .select()
            .single();
            
        if (error) throw error;
        return result;
    },

    /**
     * Update user subscription status
     */
    async updateSubscriptionStatus(
        walletAddress: string,
        subscriptionData: {
            hasActiveSubscription: boolean;
            productId?: string;
            expiresAt?: Date;
            willRenew?: boolean;
        }
    ) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('users')
            .update({
                has_active_subscription: subscriptionData.hasActiveSubscription,
                subscription_product_id: subscriptionData.productId || null,
                subscription_expires_at: subscriptionData.expiresAt 
                    ? subscriptionData.expiresAt.toISOString() 
                    : null,
                subscription_will_renew: subscriptionData.willRenew || false,
                updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', walletAddress.toLowerCase())
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    /**
     * Get user by wallet address
     */
    async getUser(walletAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', walletAddress.toLowerCase())
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Get all users
     */
    async getAllUsers() {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('users')
            .select('*');
            
        if (error) throw error;
        return data;
    },
};

/**
 * Vault table operations
 */
export const vaultService = {
    /**
     * Create vault record
     */
    async createVault(vaultData: {
        vaultId: string;
        ownerAddress: string;
        cid: string;
        ipfsGatewayUrl?: string;
        releaseTimestamp: number;
        vaultType: 'text' | 'file';
        contentLength?: number;
        fileName?: string;
        fileType?: string;
        blockNumber?: number;
        transactionHash?: string;
        createdAt?: Date;
    }) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('vaults')
            .insert({
                vault_id: vaultData.vaultId,
                owner_address: vaultData.ownerAddress.toLowerCase(),
                cid: vaultData.cid,
                ipfs_gateway_url: vaultData.ipfsGatewayUrl,
                release_timestamp: new Date(vaultData.releaseTimestamp * 1000).toISOString(),
                vault_type: vaultData.vaultType,
                content_length: vaultData.contentLength,
                file_name: vaultData.fileName,
                file_type: vaultData.fileType,
                block_number: vaultData.blockNumber,
                transaction_hash: vaultData.transactionHash,
                created_at: vaultData.createdAt || new Date().toISOString(),
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    /**
     * Get vault by ID
     */
    async getVault(vaultId: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('vaults')
            .select('*')
            .eq('vault_id', vaultId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Get vaults by owner address
     */
    async getVaultsByOwner(ownerAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const normalizedAddress = ownerAddress.toLowerCase();
        
        // Debug: Check what addresses exist in the database
        const { data: allVaults, error: debugError } = await supabase
            .from('vaults')
            .select('owner_address')
            .limit(10);
        console.log(`🔍 Sample owner_addresses in DB:`, allVaults?.map(v => v.owner_address));
        console.log(`🔍 Querying for normalized address: "${normalizedAddress}"`);
        
        const { data, error } = await supabase
            .from('vaults')
            .select('*')
            .eq('owner_address', normalizedAddress);
            
        if (error) {
            console.error('❌ Supabase getVaultsByOwner error:', error);
            throw error;
        }
        console.log(`✅ Supabase getVaultsByOwner: Found ${data?.length || 0} vaults for ${normalizedAddress}`);
        if (data && data.length > 0) {
            console.log(`📋 Sample vault IDs found:`, data.slice(0, 3).map(v => v.vault_id));
        }
        return data || [];
    },

    /**
     * Update vault
     */
    async updateVault(vaultId: string, updates: {
        releaseTimestamp?: number;
        updatedAt?: Date;
    }) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const updateData: any = {
            updated_at: updates.updatedAt || new Date().toISOString(),
        };
        
        if (updates.releaseTimestamp) {
            updateData.release_timestamp = new Date(updates.releaseTimestamp).toISOString();
        }
        
        const { data, error } = await supabase
            .from('vaults')
            .update(updateData)
            .eq('vault_id', vaultId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
};

/**
 * Heir table operations
 */
export const heirService = {
    /**
     * Create heir record
     */
    async createHeir(heirData: {
        vaultId: string;
        heirAddress: string;
        grantedAt?: Date;
    }) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('heirs')
            .insert({
                vault_id: heirData.vaultId,
                heir_address: heirData.heirAddress.toLowerCase(),
                granted_at: heirData.grantedAt || new Date().toISOString(),
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    /**
     * Get heirs by vault ID (only active heirs by default)
     */
    async getHeirsByVault(vaultId: string, activeOnly: boolean = true) {
        if (!supabase) throw new Error('Supabase not configured');
        
        let query = supabase
            .from('heirs')
            .select('*')
            .eq('vault_id', vaultId);
        
        if (activeOnly) {
            query = query.eq('is_active', true);
        }
        
        const { data, error } = await query;
            
        if (error) throw error;
        return data || [];
    },

    /**
     * Get vaults by heir address (returns full vault data, not just IDs)
     */
    async getVaultsByHeir(heirAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const normalizedAddress = heirAddress.toLowerCase();
        // Join heirs with vaults to get full vault data for active heirs
        const { data, error } = await supabase
            .from('heirs')
            .select(`
                vault_id,
                is_active,
                granted_at,
                revoked_at,
                vaults (
                    vault_id,
                    owner_address,
                    cid,
                    release_timestamp,
                    vault_type,
                    content_length,
                    file_name,
                    file_type,
                    created_at,
                    block_number,
                    transaction_hash
                )
            `)
            .eq('heir_address', normalizedAddress)
            .eq('is_active', true); // Only active heirs
            
        if (error) {
            console.error('❌ Supabase getVaultsByHeir error:', error);
            throw error;
        }
        
        console.log(`✅ Supabase getVaultsByHeir: Found ${data?.length || 0} heir records for ${normalizedAddress}`);
        
        // Extract vault data from the joined result
        const result = (data || [])
            .filter(item => item.vaults !== null)
            .map(item => ({
                ...item.vaults,
                _isHeir: true,
                _heirGrantedAt: item.granted_at,
            }));
        
        console.log(`✅ Supabase getVaultsByHeir: Returning ${result.length} vaults after filtering`);
        return result;
    },

    /**
     * Get vault IDs by heir address (legacy function for compatibility)
     */
    async getVaultIdsByHeir(heirAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('heirs')
            .select('vault_id')
            .eq('heir_address', heirAddress.toLowerCase())
            .eq('is_active', true);
            
        if (error) throw error;
        return (data || []).map(item => item.vault_id);
    },

    /**
     * Remove heir access (marks as inactive instead of deleting)
     */
    async removeHeir(vaultId: string, heirAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { error } = await supabase
            .from('heirs')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString(),
            })
            .eq('vault_id', vaultId)
            .eq('heir_address', heirAddress.toLowerCase());
            
        if (error) throw error;
    },

    /**
     * Reactivate heir access (if previously revoked)
     */
    async reactivateHeir(vaultId: string, heirAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { error } = await supabase
            .from('heirs')
            .update({
                is_active: true,
                revoked_at: null,
                granted_at: new Date().toISOString(),
            })
            .eq('vault_id', vaultId)
            .eq('heir_address', heirAddress.toLowerCase());
            
        if (error) throw error;
    },
};

/**
 * Subscription table operations
 */
export const subscriptionService = {
    /**
     * Log subscription purchase
     */
    async logSubscription(subscriptionData: {
        userAddress: string;
        productId: string;
        expirationDate?: Date;
        willRenew: boolean;
    }) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('subscriptions')
            .insert({
                user_address: subscriptionData.userAddress.toLowerCase(),
                product_id: subscriptionData.productId,
                expiration_date: subscriptionData.expirationDate 
                    ? subscriptionData.expirationDate.toISOString() 
                    : null,
                will_renew: subscriptionData.willRenew,
                is_active: true,
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    /**
     * Get active subscriptions for a user
     */
    async getActiveSubscriptions(userAddress: string) {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())
            .eq('is_active', true)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    },
};

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
    return supabase !== null;
}

