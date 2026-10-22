import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function Drawer({ isOpen, onClose, title, children, className = '' }: DrawerProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useFocusTrap(panelRef, isOpen);

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        if (isOpen) panel.removeAttribute('inert');
        else panel.setAttribute('inert', '');
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            // Don't dismiss this drawer while a modal above it owns focus.
            const activeDialog = document.activeElement?.closest('[role="dialog"][aria-modal="true"]');
            if (activeDialog && activeDialog !== panelRef.current) return;
            onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                aria-hidden="true"
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal={isOpen ? 'true' : undefined}
                aria-labelledby={titleId}
                aria-hidden={!isOpen}
                tabIndex={-1}
                className={`absolute top-0 right-0 h-full w-96 bg-slate-900/95 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ease-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    } ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                    <h2 id={titleId} className="text-lg font-bold text-white tracking-tight">{title || 'Details'}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {children}
                </div>
            </div>
        </>
    );
}
