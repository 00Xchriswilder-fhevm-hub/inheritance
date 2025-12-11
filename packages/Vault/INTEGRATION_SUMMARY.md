# RevenueCat, Supabase & Railway Integration Summary

## Overview

This document summarizes the integration of RevenueCat subscriptions, Supabase database, and Railway indexer service into Legacy Vault.

## Folder Structure

```
packages/Vault/
├── revenuecat/          # RevenueCat subscription management
│   ├── revenueCatService.ts
│   ├── RevenueCatPaywall.tsx
│   ├── CustomerCenter.tsx
│   └── useRevenueCat.ts
├── supabase/            # Supabase database service
│   └── supabaseService.ts
└── railway/             # Railway indexer service
    ├── indexer.ts       # TypeScript version
    ├── indexer.js       # JavaScript version (for Railway)
    └── package.json
```

## Implementation Checklist

### ✅ Completed

1. **Folder Structure**
   - Created `revenuecat/`, `supabase/`, and `railway/` folders

2. **RevenueCat Integration**
   - Installed `@revenuecat/purchases-js` package
   - Created `revenueCatService.ts` with full subscription management
   - Implemented `RevenueCatPaywall.tsx` component
   - Implemented `CustomerCenter.tsx` component
   - Created `useRevenueCat.ts` hook for initialization
   - Added subscription check before vault creation
   - Integrated paywall modal in CreateVaultPage

3. **Supabase Integration**
   - Created `supabaseService.ts` with database operations
   - Implemented user, vault, and heir services
   - Added environment variable configuration

4. **Railway Indexer**
   - Created `indexer.ts` (TypeScript) and `indexer.js` (JavaScript)
   - Implemented event indexing for:
     - VaultCreated
     - AccessGranted
     - AccessRevoked
     - ReleaseTimeExtended
   - Added block tracking and state management

5. **UI Integration**
   - Added Profile tab to MyVaultsPage
   - Integrated subscription status display
   - Added paywall trigger in CreateVaultPage

### ⏳ Pending

1. **Contract Updates**
   - Add ERC20 token payment tracking for initial vault creation
   - Implement token deduction mechanism

2. **Environment Configuration**
   - Add Supabase credentials to `.env`
   - Configure Railway environment variables

3. **Database Setup**
   - Create Supabase tables (users, vaults, heirs, indexer_state)
   - Set up database indexes

4. **Railway Deployment**
   - Deploy indexer service to Railway
   - Configure Railway environment variables
   - Set up continuous running service

## Next Steps

1. **Install Dependencies**
   ```bash
   cd packages/Vault
   npm install @revenuecat/purchases-js @supabase/supabase-js
   ```

2. **Configure Environment Variables**
   - Add RevenueCat API key
   - Add Supabase URL and keys
   - Add contract address

3. **Set Up Supabase Database**
   - Create tables using SQL from `supabase/README.md`
   - Configure Row Level Security (RLS) policies

4. **Deploy Railway Indexer**
   - Create Railway project
   - Set environment variables
   - Deploy `railway/indexer.js`

5. **Test Integration**
   - Test subscription flow
   - Test vault creation with subscription check
   - Verify indexer syncs data to Supabase

## RevenueCat Configuration

### Products Setup
- **monthly**: Monthly subscription
- **yearly**: Annual subscription

### Entitlement
- **Legacy Vault Pro**: Required for vault creation

### API Key
- Test: `test_PCPmbPwNWrWijDKwwNoGPOcrZTv`
- Production: Set in RevenueCat dashboard

## Supabase Configuration

### Required Tables
1. `users` - User wallet addresses
2. `vaults` - Vault records
3. `heirs` - Heir access records
4. `indexer_state` - Indexer tracking

### Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Railway Configuration

### Environment Variables
- `CONTRACT_ADDRESS` - FHELegacyVault contract address
- `RPC_URL` - Ethereum RPC endpoint
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Deployment
- Use `railway/indexer.js` for deployment
- Runs continuously, indexing every 30 seconds

## Testing Checklist

- [ ] RevenueCat initialization on wallet connect
- [ ] Subscription purchase flow
- [ ] Entitlement checking
- [ ] Paywall display
- [ ] Customer center functionality
- [ ] Subscription check before vault creation
- [ ] Supabase user creation
- [ ] Supabase vault creation
- [ ] Railway indexer sync
- [ ] Profile tab display

