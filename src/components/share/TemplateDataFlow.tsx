'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TemplateDataFlowProps {
    data: {
        nickname: string;
        avatarUrl: string;
        planName: string;
        completedAt: string;
        totalVolume: number;
        totalSets: number;
        durationMinutes: number;
        prRecords: any[];
        shareToken: string;
        /** 拉新落地页链接（/s/<shareId>） */
        acquisitionUrl?: string;
        user: {
            nickname: string;
            avatarUrl: string;
        };
    };
}

const TemplateDataFlow: React.FC<TemplateDataFlowProps> = ({ data }) => {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/training/${data.shareToken}`;
    const qrUrl = data.acquisitionUrl || shareUrl;
    const dateStr = format(new Date(data.completedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

    return (
        <div className="w-[350px] bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] text-white p-6 relative flex flex-col gap-6 overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-purple-600/20 rounded-full blur-[60px]"></div>
            <div className="absolute bottom-[10%] left-[-10%] w-32 h-32 bg-blue-600/20 rounded-full blur-[50px]"></div>
            
            {/* Header: User Profile */}
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 shrink-0">
                    {data.user.avatarUrl ? (
                        <img src={data.user.avatarUrl} alt={data.user.nickname} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white/40">
                            {data.user.nickname?.charAt(0)}
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-sm tracking-wide">{data.user.nickname}</h4>
                    <p className="text-[10px] text-white/50">{dateStr} · 训练打卡</p>
                </div>
            </div>

            {/* Plan Info */}
            <div className="relative z-10">
                <div className="inline-block px-2 py-1 bg-white/10 rounded text-[10px] text-white/70 mb-1">
                    TARGET MISSION
                </div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase leading-tight">
                    {data.planName}
                </h2>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
                    <span className="text-[10px] text-white/40 uppercase font-bold mb-1">Total Volume</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-primary-400 leading-none">
                            {data.totalVolume.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-white/40">KG</span>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
                    <span className="text-[10px] text-white/40 uppercase font-bold mb-1">Total Sets</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-blue-400 leading-none">
                            {data.totalSets}
                        </span>
                        <span className="text-[10px] font-bold text-white/40">SETS</span>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col col-span-2">
                    <span className="text-[10px] text-white/40 uppercase font-bold mb-1">Duration</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-purple-400 leading-none">
                            {data.durationMinutes}
                        </span>
                        <span className="text-[10px] font-bold text-white/40">MINUTES</span>
                    </div>
                </div>
            </div>

            {/* PR Records if any */}
            {data.prRecords && data.prRecords.length > 0 && (
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                        <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest italic">New Progress Discovered</span>
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                    </div>
                    <div className="space-y-2">
                        {data.prRecords.slice(0, 3).map((pr, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                                <span className="text-xs font-bold text-yellow-200">{pr.exerciseName}</span>
                                <span className="text-xs font-black text-yellow-500">{pr.weight}kg × {pr.reps}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer: QR and Logo */}
            <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/10 relative z-10">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-5 h-5 bg-primary-500 rounded flex items-center justify-center">
                            <span className="text-[10px] font-black italic text-white">CL</span>
                        </div>
                        <span className="text-xs font-black italic tracking-tighter">COACHLINK</span>
                    </div>
                    <p className="text-[8px] text-white/30 lowercase">
                        Scan to join CoachLink · +2 AI & +100MB
                    </p>
                </div>
                <div className="p-1 bg-white rounded-lg">
                    <QRCodeSVG value={qrUrl} size={48} level="L" />
                </div>
            </div>

            {/* Side Label */}
            <div className="absolute top-1/2 right-[-30px] -rotate-90 origin-center text-[40px] font-black text-white/[0.03] pointer-events-none uppercase italic">
                WORKOUT LOG
            </div>
        </div>
    );
};

export default TemplateDataFlow;
