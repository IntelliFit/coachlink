'use client';

import React from 'react';

interface AeroInputTextProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'default' | 'ghost';
}

export const AeroInputText = React.forwardRef<HTMLInputElement, AeroInputTextProps>(
    ({ className = '', variant = 'default', id, disabled, ...props }, ref) => {
        
        // 1. 基础容器样式 (完全镜像 AeroInputNumber 的外框)
        const containerBase = `
            relative w-full flex items-center transition-all duration-300
            ${variant === 'default' 
                ? 'bg-surface-0 border border-surface-200/80 rounded-2xl focus-within:border-primary-500/40 focus-within:ring-4 focus-within:ring-primary-500/5' 
                : 'bg-transparent border-none'
            }
            ${disabled ? 'opacity-40 bg-surface-50' : ''}
        `;

        // 2. 内部 Input 样式 (确保高度、字体、间距一致)
        const inputStyles = `
            w-full bg-transparent text-surface-900 tracking-tight
            py-2.5 px-4 outline-none border-none
            placeholder:text-surface-400 placeholder:font-normal
            disabled:cursor-not-allowed
            ${className}
        `;

        return (
            <div className={`group relative inline-flex items-center w-full`}>
                <div className={containerBase}>
                    <input
                        id={id}
                        ref={ref}
                        disabled={disabled}
                        className={inputStyles}
                        {...props}
                    />
                    
                    {/* 3. 装饰层：模拟物理深度感 */}
                    {variant === 'default' && (
                        <div className="absolute inset-0 rounded-2xl pointer-events-none shadow-sm group-focus-within:shadow-none transition-shadow" />
                    )}
                </div>
            </div>
        );
    }
);

AeroInputText.displayName = 'AeroInputText';