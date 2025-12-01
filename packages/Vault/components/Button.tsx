import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    icon,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-black tracking-wide transition-all duration-200 border-2 rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed uppercase";
    
    const variants = {
        primary: "bg-primary text-black border-primary hover:bg-primary-hover hover:border-primary-hover shadow-neo hover:shadow-neo-hover hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary: "bg-surface text-foreground border-border hover:border-muted hover:bg-surface-hover hover:text-white active:bg-surface-hover/80",
        outline: "bg-transparent text-foreground border-border hover:border-primary hover:text-primary active:bg-primary/10",
        danger: "bg-error/10 text-error border-error hover:bg-error hover:text-white shadow-none hover:shadow-neo-sm"
    };

    const sizes = {
        sm: "px-3 py-2 text-xs",
        md: "px-6 py-3.5 text-sm",
        lg: "px-8 py-4 text-base",
    };

    return (
        <button
            className={`
                ${baseStyles}
                ${variants[variant]}
                ${sizes[size]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isLoading && icon && <span className="mr-2">{icon}</span>}
            {children}
        </button>
    );
};

export default Button;