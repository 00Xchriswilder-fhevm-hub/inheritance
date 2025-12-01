import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
    const variants = {
        success: 'bg-green-900/30 text-green-400 border-green-800',
        warning: 'bg-orange-900/30 text-orange-400 border-orange-800',
        error: 'bg-red-900/30 text-red-400 border-red-800',
        info: 'bg-blue-900/30 text-blue-400 border-blue-800',
        neutral: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    };

    return (
        <span className={`
            inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border
            ${variants[variant]}
            ${className}
        `}>
            {children}
        </span>
    );
};

export default Badge;
