import React from 'react';

interface HowItWorksProps {
  isOpen: boolean;
  onClose: () => void;
}

const HowItWorks: React.FC<HowItWorksProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-2xl mx-auto bg-black border-2 border-white/10 rounded-2xl p-6 md:p-8 lg:p-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-white text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-white/80 text-base leading-relaxed">
            Learn how LegacyVault securely protects your digital assets through a multi-layer encryption process.
          </p>
        </div>

        {/* Sepolia Testnet Notice */}
        <div className="mb-8 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
          <p className="text-white font-bold text-base leading-relaxed">
            ⚠️ IMPORTANT: Your wallet must be connected to SEPOLIA TESTNET. FHEVM will fail on other networks.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {/* Step 1 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="text-white text-xl font-bold">Prepare Your Content</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11">
              Enter your secret text (like recovery phrases) or upload a file. This content will be encrypted before leaving your device.
            </p>
          </div>

          {/* Step 2 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="text-white text-xl font-bold">AES-256-GCM Encryption</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11 mb-3">
              Your data is encrypted using AES-256-GCM (Advanced Encryption Standard) with Galois/Counter Mode:
            </p>
            <ul className="text-white/70 text-sm leading-relaxed ml-11 space-y-2 list-disc list-inside">
              <li>A 256-bit encryption key is randomly generated in your browser</li>
              <li>Your content is encrypted with this key using AES-GCM, which provides both confidentiality and authenticity</li>
              <li>The encrypted data never leaves your device in plaintext form</li>
              <li>GCM mode ensures data integrity - any tampering will be detected</li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="text-white text-xl font-bold">IPFS Storage</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11">
              The encrypted data is uploaded to IPFS (InterPlanetary File System), a decentralized storage network. You receive a Content Identifier (CID) that points to your encrypted data. Only the encrypted version is stored - IPFS never sees your original content.
            </p>
          </div>

          {/* Step 4 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                4
              </div>
              <h3 className="text-white text-xl font-bold">FHE Encryption Flow</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11 mb-3">
              The AES key is then encrypted using Fully Homomorphic Encryption (FHE) via Zama's FHEVM:
            </p>
            <ul className="text-white/70 text-sm leading-relaxed ml-11 space-y-2 list-disc list-inside">
              <li>The 32-byte AES key is converted to a 256-bit number</li>
              <li>FHE encryption is performed using FHEVM, which allows computation on encrypted data</li>
              <li>A cryptographic proof is generated to verify the encryption was performed correctly</li>
              <li>The FHE-encrypted key can be stored on-chain while remaining encrypted</li>
              <li>Only authorized addresses (owner or designated heirs) can decrypt the FHE-encrypted key</li>
            </ul>
          </div>

          {/* Step 5 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                5
              </div>
              <h3 className="text-white text-xl font-bold">Blockchain Storage</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11">
              The IPFS CID and FHE-encrypted AES key are stored on the blockchain smart contract. You can set a release timestamp and designate authorized heirs who can access the vault after the release time.
            </p>
          </div>

          {/* Step 6 */}
          <div className="border-l-2 border-primary pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm">
                6
              </div>
              <h3 className="text-white text-xl font-bold">Access Control</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed ml-11">
              As the owner, you can unlock your vault at any time. Designated heirs can access the vault only after the release timestamp. The blockchain enforces these permissions through smart contract logic.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-white/60 text-sm text-center">
            Your data is protected by multiple layers of encryption, ensuring maximum security for your digital legacy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;

