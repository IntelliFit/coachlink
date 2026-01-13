'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TemplateMinimalistProps {
    data: {
        nickname: string;
        avatarUrl: string;
        planName: string;
        completedAt: string;
        totalVolume: number;
        totalSets: number;
        durationMinutes: number;
        shareToken: string;
        acquisitionUrl?: string;
        user: {
            nickname: string;
            avatarUrl: string;
        };
    };
}

const TemplateMinimalist: React.FC<TemplateMinimalistProps> = ({ data }) => {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/training/${data.shareToken}`;
    const qrUrl = data.acquisitionUrl || shareUrl;
    const dateStr = format(new Date(data.completedAt), 'MMM dd, yyyy');

    return (
        <div className="w-[350px] aspect-[4/5] relative flex flex-col items-center justify-center p-8 overflow-hidden bg-slate-900">
            {/* Background Image with Overlay */}
            <div 
                className="absolute inset-0 bg-cover bg-center z-0 opacity-60 scale-105"
                style={{ 
                    backgroundImage: 'url("https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop")',
                    filter: 'grayscale(0.5) contrast(1.2)'
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-1 bg-opacity-40"></div>
            
            {/* Glassmorphism Content Card */}
            <div className="relative z-10 w-full flex flex-col items-center text-white gap-8">
                {/* User Info */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full border-2 border-white/30 p-1 backdrop-blur-sm">
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/20">
                            {data.user.avatarUrl ? (
                                <img src={data.user.avatarUrl} alt={data.user.nickname} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-white/10">
                                    {data.user.nickname?.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/70">{data.user.nickname}</p>
                </div>

                {/* Main Quote / Status */}
                <div className="text-center space-y-2">
                    <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.8]">
                        JUST<br/>DID IT.
                    </h2>
                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary-400">
                        {data.planName}
                    </p>
                </div>

                {/* Floating Glass Stats */}
                <div className="grid grid-cols-3 w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 gap-2">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Vol</p>
                        <p className="text-sm font-black">{Math.round(data.totalVolume/1000)}t</p>
                    </div>
                    <div className="text-center border-x border-white/10">
                        <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Sets</p>
                        <p className="text-sm font-black">{data.totalSets}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Min</p>
                        <p className="text-sm font-black">{data.durationMinutes}</p>
                    </div>
                </div>

                {/* Minimal QR and Label */}
                <div className="flex items-center gap-6 w-full pt-4 border-t border-white/10">
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center">
                                <span className="text-[8px] font-black text-black italic">CL</span>
                            </div>
                            <span className="text-[10px] font-black italic tracking-tight">COACHLINK</span>
                        </div>
                        <p className="text-[8px] text-white/40 font-medium">
                            NO EXCUSES. JUST RESULTS.<br/>
                            {dateStr}
                        </p>
                    </div>
                    <div className="p-1 bg-white rounded opacity-80 hover:opacity-100 transition-opacity">
                        <QRCodeSVG value={qrUrl} size={36} level="L" />
                    </div>
                </div>
            </div>

            {/* Accent Circle */}
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        </div>
    );
};

export default TemplateMinimalist;
