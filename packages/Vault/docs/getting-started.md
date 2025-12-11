# Getting Started with Legacy Vault

Welcome to Legacy Vault! This guide will help you get started with securing your digital legacy in just a few minutes.

## Prerequisites

Before you begin, make sure you have:

- **A Web3 Wallet**: MetaMask, WalletConnect, or any compatible Ethereum wallet
- **Test ETH**: For Sepolia testnet (get free test ETH from [faucets](https://sepoliafaucet.com/))
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

## Step 1: Connect Your Wallet

1. Visit the Legacy Vault application
2. Click **"Connect Wallet"** in the top right corner
3. Select your wallet provider (MetaMask, WalletConnect, etc.)
4. Approve the connection request in your wallet
5. Ensure you're connected to **Sepolia Testnet** (for testing)

> **Note**: Legacy Vault is currently deployed on Sepolia testnet. Make sure your wallet is connected to the correct network.

## Step 2: Create Your First Vault

### 2.1 Navigate to Create Vault

- Click **"Create Vault"** from the landing page or navigation menu
- You'll see a 4-step wizard

### 2.2 Step 1: Add Your Content

Choose what type of content you want to store:

**Option A: Secret Text**
- Click the **"Secret Text"** tab
- Enter your sensitive information (recovery phrase, private key, notes, etc.)
- Toggle **"Mask Content"** to hide what you're typing
- Click **"Continue"**

**Option B: File Upload**
- Click the **"File Upload / Sharing"** tab
- Drag and drop your file or click to browse
- Supported file types: Any file type
- Maximum size: Check current limits
- Click **"Continue"**

### 2.3 Step 2: Add Your Heirs

Specify who will have access to your vault:

1. Enter wallet addresses in the heir input fields
2. Click **"Add Another Heir"** to add more addresses
3. Invalid addresses will be highlighted in red
4. Valid addresses will show in yellow/primary color
5. Click **"Continue"**

> **Important**: 
> - Double-check each wallet address for accuracy
> - You can add or remove heirs later (before release time)
> - You can revoke access before the release time

### 2.4 Step 3: Set the Release Schedule

Choose when your heirs can access the vault:

1. **Select Release Date**: Use the calendar picker
   - Navigate months/years with arrow buttons
   - Click a date to select it
   - Past dates are disabled

2. **Select Release Time**: 
   - Enter hour and minute
   - Choose AM/PM
   - Select timezone (including UTC)

3. **Review Release ETA**: Preview shows the exact release date and time
4. Click **"Continue"**

> **Note**: As the owner, you can always access your vault immediately, regardless of the release time.

### 2.5 Step 4: Review & Create

Review all your vault details:

- **Vault Details**: Vault ID, type, content length/file name, owner address
- **Access & Schedule**: Number of authorized heirs, release date, release time

1. Review all information carefully
2. Click **"Create Vault"** button
3. Approve the transaction in your wallet
4. Wait for transaction confirmation

> **Important**: Save your **Vault ID**! You'll need it to unlock your vault later.

## Step 3: Grant Access to Heirs

After creating your vault:

1. If you added heirs during creation, you'll see a **"Grant Access"** option
2. Click **"Grant Access"** for each heir address
3. Approve the transaction in your wallet
4. Wait for confirmation

> **Note**: You can also grant access later from the "My Vaults" page.

## Step 4: Access Your Vault

### As Owner

1. Navigate to **"My Vaults"** or **"Unlock Owner"**
2. Enter your **Vault ID**
3. Click **"Unlock Vault"**
4. Your decrypted content will be displayed
5. You can download files or copy text

### As Heir

1. Navigate to **"Unlock Heir"**
2. Enter the **Vault ID** (provided by the owner)
3. Check if release time has passed
4. Click **"Unlock Vault"**
5. Your decrypted content will be displayed

> **Note**: Heirs can only unlock after the release time has passed.

## Managing Your Vaults

### View All Vaults

- Go to **"My Vaults"** page
- See all vaults you own or have access to
- View status: LOCKED or RELEASED
- See countdown timers for locked vaults

### Manage a Vault

Click **"Manage"** on any vault card to:

- **View Details**: See full vault information
- **Edit Release Schedule**: Change release date/time (owner only)
- **Manage Heirs**: Add or remove authorized heirs (owner only)
- **Unlock**: Access vault content

## Best Practices

### Security

- ✅ **Never share your wallet private key**
- ✅ **Keep your Vault ID secure** - treat it like a password
- ✅ **Verify heir addresses** before granting access
- ✅ **Test with small amounts** first on testnet
- ✅ **Use a hardware wallet** for production use

### Organization

- 📁 **Use descriptive content** - make it clear what's in each vault
- 📅 **Set realistic release times** - consider your planning horizon
- 👥 **Document your heirs** - keep a record of who has access
- 🔄 **Review regularly** - check your vaults periodically

### Backup

- 💾 **Save Vault IDs** in a secure location
- 📝 **Document heir addresses** separately
- 🔐 **Consider multiple vaults** for different purposes
- 📧 **Inform trusted contacts** about your vault setup

## Troubleshooting

### Common Issues

**"Transaction Failed"**
- Check you have enough ETH for gas
- Ensure you're on the correct network (Sepolia)
- Try increasing gas limit

**"Vault Not Found"**
- Verify the Vault ID is correct
- Check you're connected to the right network
- Ensure the vault was created successfully

**"Release Time Not Reached"**
- Check the release date and time
- Verify timezone settings
- Wait for the blockchain timestamp to pass

**"Access Denied"**
- Verify you're using the correct wallet address
- Check if you're authorized as a heir
- Ensure release time has passed (for heirs)

For more help, see our [Troubleshooting Guide](./troubleshooting.md).

## Next Steps

Now that you've created your first vault:

1. **Explore Features**: Check out our [Features Guide](./features.md)
2. **Learn Architecture**: Understand how it works in [Architecture](./architecture.md)
3. **Read Security**: Learn about our [Security Model](./security.md)
4. **See Roadmap**: Check [Planned Features](./planned-features.md)

## Need Help?

- 📖 Read the [FAQ](./faq.md)
- 🐛 Check [Troubleshooting](./troubleshooting.md)
- 💬 Join our community discussions
- 📧 Contact support

---

*Next: [Features](./features.md) | [Architecture](./architecture.md)*

