import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: React.ReactNode;
    duration: number;
}

interface ToastContextValue {
    addToast: (message: React.ReactNode, type: ToastType, duration?: number) => void;
    success: (message: React.ReactNode, duration?: number) => void;
    error: (message: React.ReactNode, duration?: number) => void;
    warning: (message: React.ReactNode, duration?: number) => void;
    info: (message: React.ReactNode, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: React.ReactNode, type: ToastType, duration = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { id, message, type, duration };
        
        setToasts((prev) => [...prev, newToast]);

        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, [removeToast]);

    const success = useCallback((msg: React.ReactNode, dur?: number) => addToast(msg, 'success', dur), [addToast]);
    const error = useCallback((msg: React.ReactNode, dur?: number) => addToast(msg, 'error', dur), [addToast]);
    const warning = useCallback((msg: React.ReactNode, dur?: number) => addToast(msg, 'warning', dur), [addToast]);
    const info = useCallback((msg: React.ReactNode, dur?: number) => addToast(msg, 'info', dur), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, warning, info }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div 
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border border-border min-w-[300px] max-w-md animate-[slideIn_0.3s_ease-out]
                            ${toast.type === 'success' ? 'bg-surface text-foreground' : ''}
                            ${toast.type === 'error' ? 'bg-surface text-foreground' : ''}
                            ${toast.type === 'warning' ? 'bg-surface text-foreground' : ''}
                            ${toast.type === 'info' ? 'bg-surface text-foreground' : ''}
                        `}
                        style={{
                            backgroundColor: '#1a1a1a',
                            borderLeft: `4px solid ${
                                toast.type === 'success' ? '#4ade80' : 
                                toast.type === 'error' ? '#f87171' : 
                                toast.type === 'warning' ? '#fb923c' : '#60a5fa'
                            }`
                        }}
                    >
                        <div className={`mt-0.5 ${
                             toast.type === 'success' ? 'text-success' : 
                             toast.type === 'error' ? 'text-error' : 
                             toast.type === 'warning' ? 'text-warning' : 'text-info'
                        }`}>
                            {toast.type === 'success' && <CheckCircle size={18} />}
                            {toast.type === 'error' && <AlertCircle size={18} />}
                            {toast.type === 'warning' && <AlertTriangle size={18} />}
                            {toast.type === 'info' && <Info size={18} />}
                        </div>
                        <div className="flex-1 text-sm font-medium">{toast.message}</div>
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="text-muted hover:text-foreground transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
