'use client';

import React, { useRef, useState, useEffect } from 'react';

interface AeroInputNumberProps {
    id?: string;
    name?: string;
    value?: number | null;
    onValueChange?: (e: { value: number | null, name?: string }) => void;
    min?: number;
    max?: number;
    step?: number;
    prefix?: string; // 新增：前缀
    suffix?: string;
    placeholder?: string;
    disabled?: boolean;
    showButtons?: boolean;
    className?: string;
    inputClassName?: string;
    mode?: 'decimal' | 'integer';
    minFractionDigits?: number;
    maxFractionDigits?: number;
    inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const AeroInputNumber: React.FC<AeroInputNumberProps> = ({
    id,
    name,
    value,
    onValueChange,
    min,
    max,
    step = 1,
    prefix = '', // 默认空
    suffix = '',
    placeholder = '',
    disabled = false,
    showButtons = false,
    className = '',
    inputClassName = '',
    mode = 'decimal',
    minFractionDigits = 0,
    maxFractionDigits = 2,
    inputRef: externalRef
}) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = externalRef || internalRef;
    
    const formatValue = (val: number | null): string | number => {
        if (val === null || isNaN(val)) return '';
        if (mode === 'decimal') {
            const fractionDigits = Math.max(minFractionDigits, 
                Math.min(maxFractionDigits, (val.toString().split('.')[1] || '').length)
            );
            return val.toFixed(Math.max(minFractionDigits, fractionDigits));
        }
        return Math.floor(val);
    };

    const [inputValue, setInputValue] = useState<string | number>(formatValue(value ?? null));

    useEffect(() => {
        if (document.activeElement !== inputRef.current) {
            setInputValue(formatValue(value ?? null));
        }
    }, [value, minFractionDigits, maxFractionDigits]);

    const triggerChange = (val: number | null) => {
        onValueChange?.({ value: val, name: name });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        setInputValue(rawValue);
        if (rawValue === '') {
            triggerChange(null);
            return;
        }
        const num = Number(rawValue);
        if (!isNaN(num)) triggerChange(num);
    };

    const handleBlur = () => {
        if (inputValue === '' || inputValue === null) return;
        let num = Number(inputValue);
        if (isNaN(num)) return;
        let corrected = num;
        if (min !== undefined) corrected = Math.max(min, corrected);
        if (max !== undefined) corrected = Math.min(max, corrected);
        const formatted = formatValue(corrected);
        setInputValue(formatted);
        triggerChange(Number(formatted));
    };

    const adjustStep = (delta: number) => {
        if (disabled) return;
        const currentVal = Number(value ?? min ?? 0);
        let nextVal = currentVal + delta;
        if (min !== undefined) nextVal = Math.max(min, nextVal);
        if (max !== undefined) nextVal = Math.min(max, nextVal);
        const formatted = formatValue(nextVal);
        setInputValue(formatted);
        triggerChange(Number(formatted));
    };

    return (
        <div className={`group relative inline-flex items-center w-full ${className}`}>
            <div className="relative w-full flex items-center bg-surface-0 transition-all duration-300 focus-within:border-primary-500/40 focus-within:ring-4 focus-within:ring-primary-500/5 overflow-hidden">
                
                {/* 1. Prefix 渲染逻辑 */}
                {prefix && (
                    <span className="absolute left-4 text-xs font-black text-surface-400 pointer-events-none select-none tracking-tight">
                        {prefix.trim()}
                    </span>
                )}

                <input
                    id={id}
                    name={name}
                    ref={inputRef}
                    type="number"
                    value={inputValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`
                        w-full bg-transparent text-surface-900 tracking-tight
                        placeholder:text-surface-400 placeholder:font-normal
                        disabled:opacity-40
                        flex-1 p-inputtext p-component p-filled
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                        ${suffix ? 'pr-14' : ''} 
                        ${inputClassName}
                    `}
                />

                {/* 2. Suffix 渲染逻辑 */}
                {suffix && (
                    <span className="absolute right-4 text-xs font-black text-surface-400 pointer-events-none select-none tracking-tight">
                        {suffix.trim()}
                    </span>
                )}
            </div>

            {/* 3. Stepper 按钮保持物理按键感 */}
            {showButtons && !disabled && (
                <div className="flex flex-col ml-2 gap-1 px-1 py-1 bg-surface-50 rounded-xl border border-surface-100 shadow-sm">
                    <button type="button" tabIndex={-1} onClick={() => adjustStep(step)} className="flex items-center justify-center w-6 h-5 text-surface-500 hover:text-primary-600 hover:bg-surface-0 rounded-md transition-all active:scale-90">
                        <i className="pi pi-chevron-up text-[8px]" />
                    </button>
                    <button type="button" tabIndex={-1} onClick={() => adjustStep(-step)} className="flex items-center justify-center w-6 h-5 text-surface-500 hover:text-primary-600 hover:bg-surface-0 rounded-md transition-all active:scale-90">
                        <i className="pi pi-chevron-down text-[8px]" />
                    </button>
                </div>
            )}
        </div>
    );
};