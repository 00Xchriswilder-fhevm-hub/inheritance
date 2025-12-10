import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
            <div className="flex h-full grow flex-col">
                <div className="flex flex-1 justify-center py-5">
                    <div className="flex flex-col max-w-[960px] flex-1">
                        {/* Header */}
                        <header className="sticky top-5 z-50 flex items-center justify-between whitespace-nowrap border border-solid border-white/10 bg-background-dark/50 backdrop-blur-md px-10 py-3 rounded-lg mx-4 sm:mx-0">
                            <div className="flex items-center gap-4 text-white">
                                <div className="size-6 text-primary">
                                    <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                        <g clipPath="url(#clip0_6_535)">
                                            <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fillRule="evenodd"></path>
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_6_535">
                                                <rect fill="white" height="48" width="48"></rect>
                                            </clipPath>
                                        </defs>
                                    </svg>
                                </div>
                                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">LegacyVault</h2>
                            </div>
                            <div className="hidden sm:flex flex-1 justify-end gap-8">
                                <div className="flex items-center gap-9"></div>
                                <button 
                                    onClick={() => navigate('/create')}
                                    className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
                                >
                                    <span className="truncate">Secure Legacy</span>
                                </button>
                            </div>
                        </header>

                        <main className="flex flex-col gap-16 md:gap-24 mt-16">
                            {/* Hero Section */}
                            <section className="px-4">
                                <div className="md:p-4">
                                    <div 
                                        className="flex min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat md:gap-8 md:rounded-lg items-start justify-end px-4 pb-10 md:px-10" 
                                        style={{
                                            backgroundImage: 'linear-gradient(rgba(18, 18, 18, 0.1) 0%, rgba(18, 18, 18, 0.8) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuCvkHy9S8lV1UMwWS1nAgKXYds7Etv6n4lGsMIxOoJzOsdyzWsuBk5LBpJPXAwmz1JVh-f-rYk4_jfPsii7hSnmIMGj249aRTFBOGqGnjpQ_VBY0-ZqCL1lCuyWC_XtENx11n3bBuO1EoAzcYArdDWC10TXFRYkFaeLCvgNRRqPK7N4G084mALtL3Jm9QAm8UcIDdPOQwgBrePSqzwDfqNC7SV7cUROif_DPsarL33Zn3M2mWBGo0k2EAJKCxO0z_LKaXcVGzsD5g")'
                                        }}
                                    >
                                        <div className="flex flex-col gap-4 text-left max-w-3xl">
                                            <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] md:text-5xl">
                                                The Future of Digital Inheritance. Secured by Confidential Computing on EVM.
                                            </h1>
                                            <p className="text-white/90 text-sm font-normal leading-normal md:text-base">
                                                LegacyVault combines time-locked access and Fully Homomorphic Encryption to protect your digital assets for the next generation.
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/create')}
                                            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 md:h-12 md:px-5 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] md:text-base hover:bg-primary/90 transition-colors"
                                        >
                                            <span className="truncate">Secure Your Assets</span>
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Features Section */}
                            <section className="flex flex-col gap-10 px-4 py-10" id="features">
                                <div className="flex flex-col gap-4">
                                    <h2 className="text-white tracking-light text-[32px] font-bold leading-tight md:text-4xl md:font-black md:leading-tight md:tracking-[-0.033em] max-w-[720px]">
                                        Secure, Time-Locked, and Decentralized
                                    </h2>
                                    <p className="text-white/80 text-base font-normal leading-normal max-w-[720px]">
                                        LegacyVault provides a robust security layer for your digital assets, ensuring they are protected and accessible only by your designated beneficiaries at the right time.
                                    </p>
                                </div>
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-0">
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">lock</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Confidential Vaults</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Securely store your digital assets in vaults protected by Fully Homomorphic Encryption.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">schedule</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Time-Locked Release</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Set predetermined access triggers and time-based release schedules for your beneficiaries.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">hub</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Blockchain Access Control</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Leverage decentralized and tamper-proof permissions for ultimate control and security.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Use Cases Section */}
                            <section className="flex flex-col gap-6 px-4" id="use-cases">
                                <div className="flex flex-col gap-4 text-center items-center">
                                    <h2 className="text-white tracking-light text-[32px] font-bold leading-tight md:text-4xl md:font-black md:leading-tight md:tracking-[-0.033em] max-w-[720px]">
                                        Flexible Solutions for Every Need
                                    </h2>
                                    <p className="text-white/80 text-base font-normal leading-normal max-w-[720px]">
                                    
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Wills & Testaments</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Securely draft and store your last will, ensuring your digital and physical assets are distributed according to your wishes with absolute confidentiality.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">gavel</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Legal Agreements</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Protect sensitive contracts and legal documents with time-locked access, ensuring they are only revealed to authorized parties at the designated time.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">description</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Sensitive Forms</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Safeguard confidential information in forms such as medical records or financial statements, controlling exactly who can access them and when.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">token</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Digital Assets</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Manage and transfer cryptocurrencies, NFTs, and other digital assets with unparalleled security, ensuring they reach your intended beneficiaries.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-6 flex-col hover:bg-white/10 transition-colors">
                                        <div className="text-primary">
                                            <span className="material-symbols-outlined text-3xl">share</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white text-lg font-bold leading-tight">Secure File Sharing</h3>
                                            <p className="text-white/70 text-sm font-normal leading-normal">Share critical files with colleagues or family, with the peace of mind that they are encrypted and only accessible under the conditions you set.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Technology Section */}
                            <section className="px-4" id="technology">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-8 md:p-12 flex flex-col items-center text-center gap-6">
                                    <h2 className="text-white tracking-light text-2xl font-bold leading-tight md:text-3xl md:font-black md:leading-tight md:tracking-[-0.033em] max-w-[720px]">
                                        Powered by Cutting-Edge Confidentiality
                                    </h2>
                                    <p className="text-white/80 text-base font-normal leading-normal max-w-[600px]">
                                        We utilize Zama's Fully Homomorphic Encryption (FHE) technology—a confidential computing layer that works across all EVM-compatible blockchains. Your data remains encrypted at all times, even during processing, ensuring unparalleled security and privacy for your most sensitive assets on any chain.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <span className="text-white/60 text-sm font-medium">POWERED BY</span>
                                        <span className="text-primary text-xl font-bold">ZAMA</span>
                                    </div>
                                    <a 
                                        href="https://zama.ai" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary/90 text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                                    >
                                        Learn More About FHE Technology
                                    </a>
                                </div>
                            </section>

                            {/* CTA Section */}
                            <section className="px-4 py-10" id="faq">
                                <div className="bg-primary rounded-lg p-8 md:p-12 flex flex-col items-center text-center gap-6">
                                    <h2 className="text-black tracking-light text-3xl font-black leading-tight md:text-4xl md:font-black md:leading-tight md:tracking-[-0.033em] max-w-[720px]">
                                        Ready to Secure Your Legacy?
                                    </h2>
                                    <p className="text-black/80 text-base font-normal leading-normal max-w-[600px]">
                                        Get started with LegacyVault today and take the first step towards protecting your digital assets for the future.
                                    </p>
                                    <button 
                                        onClick={() => navigate('/create')}
                                        className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-black text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-black/80 transition-colors"
                                    >
                                        <span className="truncate">Create Your Vault</span>
                                    </button>
                                </div>
                            </section>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
