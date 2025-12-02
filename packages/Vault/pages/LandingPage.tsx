import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Key, ArrowRight, Clock, FileText, FileCheck, Layers, Zap } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col gap-16 pb-20">
            {/* Hero Section */}
            <section className="relative pt-20 pb-12 px-4 text-center">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10"></div>
                <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">
                    SECURE YOUR <br/>
                    <span className="text-primary text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark">DIGITAL LEGACY</span>
                </h1>
                <p className="text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
                    A confidential security layer for your most important documents and digital assets. 
                    Preserve wills, legal agreements, contracts, forms, and sensitive data with military-grade encryption 
                    and time-locked access control. Your confidential information remains mathematically secure until the designated release time.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button size="lg" onClick={() => navigate('/create')}>
                        Create Vault <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => navigate('/unlock-owner')}>
                        Access My Vault
                    </Button>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-7xl mx-auto px-4 w-full">
                <h2 className="text-3xl font-black text-center mb-12 uppercase">Why Choose LegacyVault</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <Card className="h-full" hoverEffect>
                        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 text-primary">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 uppercase">Double Encryption</h3>
                        <p className="text-muted">
                            Your data is encrypted with AES-256-GCM, then the decryption key is double-encrypted using Zama FHE (Fully Homomorphic Encryption) 
                            and stored on-chain. Even with blockchain access, the key remains encrypted until authorized decryption.
                        </p>
                    </Card>
                    <Card className="h-full" hoverEffect>
                        <div className="w-12 h-12 bg-info/20 rounded-lg flex items-center justify-center mb-4 text-info">
                            <Clock className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 uppercase">Time-Locked Access</h3>
                        <p className="text-muted">
                            Set a specific release date and time. Your confidential documents remain mathematically inaccessible to heirs 
                            until that exact moment, ensuring perfect timing for wills, agreements, and sensitive information.
                        </p>
                    </Card>
                    <Card className="h-full" hoverEffect>
                        <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center mb-4 text-success">
                            <Key className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 uppercase">Blockchain Access Control</h3>
                        <p className="text-muted">
                            Authorize specific wallet addresses as heirs. Access is controlled on-chain through FHEVM Access Control Lists (ACL), 
                            ensuring only authorized parties can decrypt after the release time.
                        </p>
                    </Card>
                </div>
            </section>

            {/* Use Cases */}
            <section className="max-w-7xl mx-auto px-4 w-full">
                <h2 className="text-3xl font-black text-center mb-12 uppercase">Perfect For</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="h-full" hoverEffect>
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3 text-primary">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold mb-2 uppercase">Wills & Testaments</h3>
                        <p className="text-sm text-muted">
                            Securely store your last will and testament with time-locked release to beneficiaries.
                        </p>
                    </Card>
                    <Card className="h-full" hoverEffect>
                        <div className="w-10 h-10 bg-info/20 rounded-lg flex items-center justify-center mb-3 text-info">
                            <FileCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold mb-2 uppercase">Legal Agreements</h3>
                        <p className="text-sm text-muted">
                            Preserve contracts, partnership agreements, and legal documents with confidential access control.
                        </p>
                    </Card>
                    <Card className="h-full" hoverEffect>
                        <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center mb-3 text-success">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold mb-2 uppercase">Sensitive Forms</h3>
                        <p className="text-sm text-muted">
                            Protect tax documents, medical records, and confidential forms with military-grade encryption.
                        </p>
                    </Card>
                    <Card className="h-full" hoverEffect>
                        <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center mb-3 text-warning">
                            <Key className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold mb-2 uppercase">Digital Assets</h3>
                        <p className="text-sm text-muted">
                            Secure crypto wallet mnemonics, private keys, and digital wealth for future generations.
                        </p>
                    </Card>
                </div>
            </section>

            {/* Technology Section */}
            <section className="max-w-7xl mx-auto px-4 w-full mt-16">
                <div className="bg-surface border-2 border-border rounded-2xl p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                                <Layers className="w-6 h-6" />
                            </div>
                            <h2 className="text-3xl font-black uppercase">Powered by Zama FHE</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-xl font-bold mb-4 uppercase">Double-Layer Security</h3>
                                <p className="text-muted mb-4 leading-relaxed">
                                    LegacyVault uses <strong className="text-foreground">Zama FHE (Fully Homomorphic Encryption)</strong> to provide 
                                    an additional layer of security. Your data is first encrypted with AES-256-GCM, then the decryption key 
                                    is encrypted again using FHE and stored on-chain.
                                </p>
                                <p className="text-muted mb-4 leading-relaxed">
                                    This means even if someone gains access to the blockchain, they cannot decrypt your data without proper 
                                    FHEVM Access Control List (ACL) authorization. The FHE-encrypted AES key remains secure until an authorized 
                                    party uses FHEVM's homomorphic decryption capabilities.
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted mt-6">
                                    <Zap className="w-4 h-4 text-primary" />
                                    <span>FHE-encrypted keys stored on-chain via FHEVM</span>
                                </div>
                            </div>
                            <div className="bg-background border-2 border-dashed border-border rounded-xl p-6">
                                <h4 className="font-bold mb-4 uppercase text-sm text-muted">Encryption Flow</h4>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                        <div>
                                            <div className="font-bold text-sm">AES-256-GCM Encryption</div>
                                            <div className="text-xs text-muted">Your data encrypted client-side</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                        <div>
                                            <div className="font-bold text-sm">IPFS Storage</div>
                                            <div className="text-xs text-muted">Encrypted data uploaded to IPFS</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                        <div>
                                            <div className="font-bold text-sm">FHE Encryption</div>
                                            <div className="text-xs text-muted">AES key encrypted with Zama FHE</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
                                        <div>
                                            <div className="font-bold text-sm">On-Chain Storage</div>
                                            <div className="text-xs text-muted">FHE-encrypted key stored on blockchain</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Action Cards */}
            <section className="max-w-5xl mx-auto px-4 w-full">
                <div className="bg-surface border-2 border-border rounded-2xl p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                        <div>
                            <h2 className="text-3xl font-black mb-4 uppercase">Ready to secure your confidential documents?</h2>
                            <p className="text-muted mb-8">
                                Create a new vault in minutes. Upload your wills, agreements, forms, or any sensitive documents. 
                                Your wallet connection provides secure access control, and your data is protected with double encryption.
                            </p>
                            <Button variant="secondary" onClick={() => navigate('/create')}>
                                Start Vault Creation
                            </Button>
                        </div>
                        <div className="bg-background border-2 border-dashed border-border rounded-xl p-6 flex flex-col gap-4 opacity-80">
                            <div className="h-4 bg-surface-hover rounded w-3/4"></div>
                            <div className="h-4 bg-surface-hover rounded w-1/2"></div>
                            <div className="h-4 bg-surface-hover rounded w-full"></div>
                            <div className="mt-4 flex justify-end">
                                <div className="h-8 bg-primary/20 rounded w-24"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
