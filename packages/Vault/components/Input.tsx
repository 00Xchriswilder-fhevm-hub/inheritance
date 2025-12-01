import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, className = '', rightElement, ...props }, ref) => {
        return (
            <div className="w-full mb-5">
                {label && (
                    <label className="block text-xs font-black text-muted mb-2 uppercase tracking-widest">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    <input
                        ref={ref}
                        className={`
                            w-full bg-background text-foreground border-2 rounded-lg px-4 py-3.5 font-medium
                            placeholder-muted/30 focus:outline-none transition-all duration-200
                            ${error 
                                ? 'border-error focus:border-error focus:shadow-[4px_4px_0px_0px_#f87171]' 
                                : 'border-border focus:border-primary focus:shadow-neo'
                            }
                            ${className}
                        `}
                        {...props}
                    />
                    {rightElement && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {rightElement}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-2 text-xs text-error font-bold flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-error rounded-full"></span>
                        {error}
                    </p>
                )}
                {!error && helperText && (
                    <p className="mt-2 text-xs text-muted font-medium">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;