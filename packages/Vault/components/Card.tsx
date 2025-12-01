import React from 'react';

interface CardProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
    hoverEffect?: boolean;
    footer?: React.ReactNode;
    noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
    children, 
    title, 
    className = '', 
    hoverEffect = false,
    footer,
    noPadding = false
}) => {
    return (
        <div 
            className={`
                bg-surface border-2 border-border rounded-xl overflow-hidden
                ${hoverEffect ? 'transition-all duration-200 hover:border-primary hover:shadow-neo hover:-translate-y-1' : 'shadow-none'}
                ${className}
            `}
        >
            {title && (
                <div className="px-6 py-4 border-b-2 border-border bg-surface-hover/50 flex items-center justify-between">
                    <h3 className="text-lg font-black text-foreground tracking-tight uppercase flex items-center gap-2">
                        {title}
                    </h3>
                </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
            {footer && (
                <div className="px-6 py-4 border-t-2 border-border bg-background/50 backdrop-blur-sm">
                    {footer}
                </div>
            )}
        </div>
    );
};

export default Card;