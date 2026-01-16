'use client';

import React, { useRef, useState, useEffect } from 'react';

interface AeroTimePickerProps {
    value?: number; // 传入的总秒数
    onValueChange?: (e: { value: number }) => void;
    disabled?: boolean;
    showButtons?: boolean;
    className?: string;
    inputClassName?: string;
    showSeconds?: boolean;
}

export const AeroTimePicker: React.FC<AeroTimePickerProps> = ({
    value = 0,
    onValueChange,
    disabled = false,
    showButtons = true,
    className = '',
    inputClassName = '',
    showSeconds = true,
}) => {
    // 将总秒数拆分为 时:分:秒
    const getParts = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return { h, m, s };
    };

    const { h, m, s } = getParts(value);
    
    // 内部状态处理字符串显示（补零）
    const format = (num: number) => num.toString().padStart(2, '0');
    
    const [displayH, setDisplayH] = useState(format(h));
    const [displayM, setDisplayM] = useState(format(m));
    const [displayS, setDisplayS] = useState(format(s));

    useEffect(() => {
        const parts = getParts(value);
        setDisplayH(format(parts.h));
        setDisplayM(format(parts.m));
        setDisplayS(format(parts.s));
    }, [value]);

    const updateTime = (newH: number, newM: number, newS: number) => {
        // 计算总秒数并确保不为负数
        let total = newH * 3600 + newM * 60 + newS;
        if (total < 0) total = 0;        
        
        onValueChange?.({ value: total });
    };

    const handleBlur = () => {
        // 失去焦点时强制格式化
        setDisplayH(format(parseInt(displayH) || 0));
        setDisplayM(format(parseInt(displayM) || 0));
        setDisplayS(format(parseInt(displayS) || 0));
        updateTime(parseInt(displayH), parseInt(displayM), parseInt(displayS));
    };

    const adjustStep = (delta: number, type: 'h' | 'm' | 's') => {
        if (disabled) return;
        const current = getParts(value);
        if (type === 'h') updateTime(current.h + delta, current.m, current.s);
        if (type === 'm') updateTime(current.h, current.m + delta, current.s);
        if (type === 's') updateTime(current.h, current.m, current.s + delta);
    };

    const inputBaseClass = `
        w-full bg-transparent text-center font-black tracking-tighter 
        text-surface-900 focus:outline-none p-0
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
        ${inputClassName}
    `;

    return (
        <div className={`group relative inline-flex items-center w-full ${className}`}>
            <div className="relative w-full flex items-center bg-surface-0 border border-surface-200 rounded-2xl transition-all duration-300 focus-within:border-primary-500/40 focus-within:ring-4 focus-within:ring-primary-500/5 overflow-hidden py-2 px-3">
                
                <div className="flex-1 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1">
                    {/* 小时 */}
                    <input
                        type="number"
                        value={displayH}
                        disabled={disabled}
                        onChange={(e) => setDisplayH(e.target.value)}
                        onBlur={handleBlur}
                        className={inputBaseClass}
                    />
                    <span className="text-surface-400 font-black animate-pulse">:</span>
                    
                    {/* 分钟 */}
                    <input
                        type="number"
                        value={displayM}
                        disabled={disabled}
                        onChange={(e) => setDisplayM(e.target.value)}
                        onBlur={handleBlur}
                        className={inputBaseClass}
                    />

                    {showSeconds && (
                        <>
                            <span className="text-surface-400 font-black animate-pulse">:</span>
                            {/* 秒 */}
                            <input
                                type="number"
                                value={displayS}
                                disabled={disabled}
                                onChange={(e) => setDisplayS(e.target.value)}
                                onBlur={handleBlur}
                                className={inputBaseClass}
                            />
                        </>
                    )}
                </div>

                {/* 物理感步进按钮 - 默认为分钟调节 */}
                {showButtons && !disabled && (
                    <div className="flex flex-col ml-3 gap-1 px-1 py-1 bg-surface-50 rounded-xl border border-surface-100 shadow-sm">
                        <button 
                            type="button" 
                            onClick={() => adjustStep(1, 'm')} 
                            className="flex items-center justify-center w-6 h-5 text-surface-500 hover:text-primary-600 hover:bg-surface-0 rounded-md transition-all active:scale-90"
                        >
                            <i className="pi pi-chevron-up text-[8px]" />
                        </button>
                        <button 
                            type="button" 
                            onClick={() => adjustStep(-1, 'm')} 
                            className="flex items-center justify-center w-6 h-5 text-surface-500 hover:text-primary-600 hover:bg-surface-0 rounded-md transition-all active:scale-90"
                        >
                            <i className="pi pi-chevron-down text-[8px]" />
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};