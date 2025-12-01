import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Key, ArrowRight, Clock } from 'lucide-react';
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
                    A decentralized, time-locked vault for your crypto assets. 
                    Ensure your heirs can access your digital wealth when the time is right, without intermediaries.
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
            <section className="max-w-7xl mx-auto px-4 w-full grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="h-full" hoverEffect>
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 text-primary">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 uppercase">Secure Encryption</h3>
                    <p className="text-muted">
                        Your mnemonic phrases are encrypted client-side using military-grade AES-256-GCM before ever touching the blockchain.
                    </p>
                </Card>
                <Card className="h-full" hoverEffect>
                    <div className="w-12 h-12 bg-info/20 rounded-lg flex items-center justify-center mb-4 text-info">
                        <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 uppercase">Time-Locked</h3>
                    <p className="text-muted">
                        Set a specific release date. Your data remains mathematically inaccessible to heirs until that exact moment.
                    </p>
                </Card>
                <Card className="h-full" hoverEffect>
                    <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center mb-4 text-success">
                        <Key className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 uppercase">Heir Access</h3>
                    <p className="text-muted">
                        Share a unique key with your trusted heir. They can only claim the vault contents after the release period passes.
                    </p>
                </Card>
            </section>

            {/* Action Cards */}
            <section className="max-w-5xl mx-auto px-4 w-full">
                <div className="bg-surface border-2 border-border rounded-2xl p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                        <div>
                            <h2 className="text-3xl font-black mb-4 uppercase">Ready to secure your assets?</h2>
                            <p className="text-muted mb-8">
                                Create a new vault in minutes. You'll need your wallet connected and the mnemonic phrase you wish to secure.
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
