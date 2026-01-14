'use client';

import React from 'react';
import { InputSwitch } from 'primereact/inputswitch';

interface Props {
    mode: 'exclusive' | 'open';
    updating: boolean;
    onModeChange: (isExclusive: boolean) => void;
}

export const InvitationModeCard: React.FC<Props> = ({ mode, updating, onModeChange }) => {
    const isExclusive = mode === 'exclusive';

    return (
        <div className="bg-white border border-surface-100 rounded-[24px] p-8 transition-all duration-500 shadow-sm hover:shadow-md">
            {/* 头部：排版层级 */}
            <div className="mb-8">
                <h3 className="text-xl font-black text-surface-900 tracking-tighter italic">
                    学员可见性模式 <span className="text-primary-500 not-italic">/ 权限</span>
                </h3>
                <p className="text-xs font-bold text-surface-400 mt-1 uppercase tracking-wider">
                    自定义通过邀请码注册的学员在平台上的内容浏览范围
                </p>
            </div>

            <div className="space-y-6">
                {/* 核心状态磁贴 */}
                <div className={`
                    relative overflow-hidden p-6 rounded-[20px] transition-all duration-500 
                    flex items-center justify-between border
                    ${isExclusive 
                        ? 'bg-orange-50/40 border-orange-100/50' 
                        : 'bg-blue-50/40 border-blue-100/50'}
                `}>
                    {/* 背景水印装饰 */}
                    <div className={`absolute -right-4 -top-4 opacity-[0.03] transition-transform duration-1000`}>
                        <i className={`pi ${isExclusive ? 'pi-shield' : 'pi-globe'} text-[120px]`} />
                    </div>

                    <div className="relative z-10 flex gap-4 items-center">
                        {/* 状态图标 */}
                        <div className={`
                            w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                            ${isExclusive ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-blue-500 text-white shadow-lg shadow-blue-200'}
                        `}>
                            <i className={`pi ${isExclusive ? 'pi-shield' : 'pi-globe'} text-2xl`} />
                        </div>
                        
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-black tracking-tight ${isExclusive ? 'text-orange-900' : 'text-blue-900'}`}>
                                    {isExclusive ? '专属隔离模式' : '全平台开放模式'}
                                </span>
                                {updating && <i className="pi pi-spin pi-spinner text-surface-400 text-xs" />}
                            </div>
                            <p className={`text-[13px] font-bold leading-relaxed max-w-[320px] ${isExclusive ? 'text-orange-700/60' : 'text-blue-700/60'}`}>
                                {isExclusive
                                    ? '学员仅能看到您的课程与计划，有效防止私域流量流失。'
                                    : '学员可自由探索全站教练，适合开放式的品牌推广场景。'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 scale-125 mr-2">
                        <InputSwitch
                            checked={isExclusive}
                            onChange={(e) => onModeChange(e.value)}
                            disabled={updating}
                        />
                    </div>
                </div>

                {/* 说明磁贴：利用非对称排版 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-surface-50/50 rounded-[18px] border border-surface-100/50">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="pi pi-check-circle text-orange-500 text-[10px]" />
                            <span className="text-[11px] font-black text-surface-400 uppercase tracking-widest">专属保护逻辑</span>
                        </div>
                        <p className="text-[12px] text-surface-600 font-bold leading-5">
                            开启后，学员在订阅期间的首页发现流将锁定为您的发布内容。
                        </p>
                    </div>

                    <div className="p-5 bg-surface-50/50 rounded-[18px] border border-surface-100/50">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="pi pi-info-circle text-blue-500 text-[10px]" />
                            <span className="text-[11px] font-black text-surface-400 uppercase tracking-widest">自由浏览权限</span>
                        </div>
                        <p className="text-[12px] text-surface-600 font-bold leading-5">
                            默认模式下，学员可以通过您的邀请注册，但保留查看其他教练的权利。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};