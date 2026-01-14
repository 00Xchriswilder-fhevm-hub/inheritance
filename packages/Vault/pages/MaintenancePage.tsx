import React from 'react';

const MaintenancePage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
            <div className="max-w-2xl mx-auto px-4 text-center">
                <div className="flex flex-col items-center gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-4">
                        <img 
                            src="/logo.png" 
                            alt="LegacyVault Logo" 
                            className="h-12 w-auto"
                        />
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white font-display">
                            LEGACY<span className="text-primary">VAULT</span>
                        </h1>
                    </div>

                    {/* Icon */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
                        <div className="relative bg-white/5 border-2 border-primary rounded-full p-8">
                            <span className="material-symbols-outlined text-6xl text-primary">build</span>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-white font-display">
                            We're Adding New Features
                        </h2>
                        <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-lg mx-auto">
                            We're currently working on exciting new features to enhance your experience. 
                            Please stay tuned for updates!
                        </p>
                        <p className="text-base text-white/60">
                            We'll be back soon with improvements to make LegacyVault even better.
                        </p>
                    </div>

                    {/* Decorative Elements */}
                    <div className="mt-8 flex gap-2 justify-center">
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
