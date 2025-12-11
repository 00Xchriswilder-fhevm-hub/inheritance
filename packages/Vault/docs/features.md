# Features

Legacy Vault provides a comprehensive set of features for secure digital inheritance. This document outlines all available features and their capabilities.

## 🔐 Security Features

### Double Encryption
- **AES-256-GCM Encryption**: Client-side encryption of all data before upload
- **FHE Encryption**: Fully Homomorphic Encryption of AES keys via ZAMA Protocol
- **On-Chain Storage**: Encrypted keys stored on Ethereum blockchain
- **IPFS Storage**: Encrypted files stored on decentralized IPFS network

### Access Control
- **FHE Access Control Lists (ACL)**: Cryptographically enforced permissions
- **Wallet-Based Authentication**: No passwords required
- **Owner Override**: Vault owners can always access their vaults
- **Heir Authorization**: Grant access to specific wallet addresses
- **Access Revocation**: Remove heir access before release time

### Time-Locked Release
- **Precise Timestamps**: Set exact date and time for release
- **Blockchain Enforcement**: Release time enforced by blockchain timestamps
- **Timezone Support**: Full timezone support including UTC
- **Owner Control**: Owners can reschedule release times anytime

## 📁 Content Management

### Content Types

#### Secret Text
- Store recovery phrases, private keys, passwords
- Secure text notes and sensitive information
- Mask content while typing
- Copy to clipboard functionality

#### File Upload
- Support for any file type
- Drag-and-drop interface
- File preview before upload
- Progress tracking during upload
- File metadata preservation

### Storage
- **IPFS Integration**: Decentralized, immutable file storage
- **Content Addressing**: Files identified by cryptographic hashes (CIDs)
- **Redundancy**: Multiple IPFS nodes store your encrypted files
- **Persistence**: Files remain available as long as IPFS network exists

## 👥 Heir Management

### Multiple Heirs
- **Unlimited Heirs**: Add as many authorized addresses as needed
- **Individual Authorization**: Each heir gets independent access
- **Batch Operations**: Grant access to multiple heirs at once
- **Heir Tracking**: View all vaults where you're authorized as heir

### Access Management
- **Grant Access**: Authorize wallet addresses as heirs
- **Revoke Access**: Remove access before release time
- **Access Verification**: Check authorization status
- **Heir Notifications**: (Planned) Automated notifications to heirs

## 📊 Vault Management

### Vault Organization
- **Vault Dashboard**: View all your vaults in one place
- **Status Indicators**: See LOCKED or RELEASED status
- **Countdown Timers**: Real-time countdown for locked vaults
- **Content Type Tags**: Identify vault type (Text/File) at a glance
- **Role Labels**: See if you're owner or heir

### Vault Operations
- **Create Vault**: 4-step wizard for vault creation
- **View Details**: Complete vault information
- **Edit Schedule**: Modify release date/time (owner only)
- **Manage Heirs**: Add or remove authorized addresses
- **Unlock Vault**: Access and decrypt vault content

### Search & Filter
- **Vault ID Search**: Find vaults by ID
- **Status Filtering**: Filter by LOCKED/RELEASED
- **Role Filtering**: Filter by owner/heir role
- **Content Type Filter**: Filter by text/file type

## 🔄 Release Management

### Release Scheduling
- **Date Picker**: Calendar interface for date selection
- **Time Picker**: Hour/minute selection with AM/PM
- **Timezone Selection**: Full timezone support
- **Release Preview**: See exact release date/time before confirming

### Release Modifications
- **Reschedule Release**: Change release date/time (owner only)
- **Extend Release**: Push release time further (owner only)
- **Immediate Access**: Owners can always access regardless of release time
- **Blockchain Updates**: All changes recorded on-chain

## 🎨 User Interface

### Design
- **Modern UI**: Clean, professional interface
- **Dark Theme**: Optimized for dark backgrounds
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Material Symbols**: Consistent iconography
- **Tailwind CSS**: Modern styling framework

### User Experience
- **Intuitive Navigation**: Easy-to-use interface
- **Progress Indicators**: Visual feedback during operations
- **Toast Notifications**: Real-time status updates
- **Error Handling**: Clear error messages
- **Loading States**: Visual feedback during processing

## 🔌 Integration

### Wallet Support
- **MetaMask**: Full support
- **WalletConnect**: Multi-wallet support
- **RainbowKit**: Unified wallet connection interface
- **Any EIP-1193 Wallet**: Compatible with standard wallets

### Network Support
- **Sepolia Testnet**: Current deployment
- **Hardhat Local**: Development network
- **Multi-Chain**: (Planned) Support for multiple networks

## 📱 Platform Support

### Web Application
- **Browser-Based**: Works in any modern browser
- **No Installation**: Access directly from web
- **Progressive Web App**: (Planned) PWA capabilities

### Mobile
- **Responsive Design**: Mobile-friendly interface
- **Mobile Apps**: (Planned) Native iOS and Android apps

## 🔍 Transparency & Audit

### On-Chain Transparency
- **Public Metadata**: Vault metadata visible on blockchain
- **Transaction History**: All operations recorded on-chain
- **Immutable Records**: Cannot be altered or deleted
- **Blockchain Explorer**: View transactions on Etherscan

### Privacy
- **Encrypted Content**: Actual content remains encrypted
- **FHE Keys**: Decryption keys never revealed
- **IPFS Privacy**: Files encrypted before IPFS upload
- **Address Privacy**: (Planned) Optional address privacy features

## 🛠️ Developer Features

### Smart Contract
- **Open Source**: Contract code publicly available
- **Verified Contracts**: Verified on Etherscan
- **TypeScript Types**: Auto-generated type definitions
- **Testing Suite**: Comprehensive test coverage

### API Access
- **Contract Interface**: Direct smart contract interaction
- **SDK**: (Planned) Software development kits
- **REST API**: (Planned) RESTful API for integration

## 📈 Analytics & Reporting

### Vault Statistics
- **Vault Count**: Total vaults created
- **Heir Count**: Number of authorized heirs
- **Storage Usage**: IPFS storage statistics
- **Network Activity**: Transaction volume

### Activity Tracking
- **Access Logs**: (Planned) Track vault access
- **Modification History**: (Planned) Change tracking
- **Audit Trail**: (Planned) Complete activity logs

## 🚀 Performance

### Speed
- **Fast Transactions**: Optimized smart contract calls
- **Quick Encryption**: Efficient client-side encryption
- **IPFS Optimization**: Fast file upload/download
- **Caching**: Smart caching for better performance

### Scalability
- **IPFS Scaling**: Decentralized storage scales automatically
- **Blockchain Scaling**: Leverages Ethereum L2 solutions
- **Batch Operations**: (Planned) Efficient bulk operations

## 🔮 Upcoming Features

See our [Planned Features](./planned-features.md) page for:
- Multi-chain support
- Vault templates
- Batch operations
- Mobile applications
- And much more!

---

*Next: [Architecture](./architecture.md) | [User Guides](./user-guides/)*

