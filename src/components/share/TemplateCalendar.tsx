'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TemplateCalendarProps {
    data: {
        nickname: string;
        avatarUrl: string;
        planName: string;
        completedAt: string;
        totalVolume: number;
        totalSets: number;
        durationMinutes: number;
        monthlyTrainingDays: string[];
        shareToken: string;
        user: {
            nickname: string;
            avatarUrl: string;
        };
    };
}

const TemplateCalendar: React.FC<TemplateCalendarProps> = ({ data }) => {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/training/${data.shareToken}`;
    const targetDate = new Date(data.completedAt);
    const monthName = format(targetDate, 'MMMM yyyy', { locale: zhCN });
    
    // Generate calendar grid for the month
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Get padding for the first week
    const firstDayOfWeek = monthStart.getDay(); // 0 is Sunday
    const padding = Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }); // Adjust to Monday start

    return (
        <div className="w-[350px] bg-white text-slate-900 p-6 flex flex-col gap-6 font-sans border border-slate-100">
            {/* Header: Minimalist */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black italic">
                        CL
                    </div>
                    <div>
                        <h4 className="font-bold text-xs uppercase tracking-tighter">CoachLink</h4>
                        <p className="text-[9px] text-slate-400 font-medium">Training Evolution</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{format(targetDate, 'EEE, MMM d')}</p>
                    <p className="text-[10px] font-medium text-slate-300">#WORKOUT_DONE</p>
                </div>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    {data.user.avatarUrl ? (
                        <img src={data.user.avatarUrl} alt={data.user.nickname} className="w-full h-full object-cover" />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-400 uppercase">
                            {data.user.nickname?.charAt(0)}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-sm text-slate-800">{data.user.nickname}</h3>
                    <p className="text-[10px] text-slate-500">已坚持训练 {data.monthlyTrainingDays?.length || 1} 天于本月</p>
                </div>
            </div>

            {/* Heatmap Section */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthName}</span>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-sm bg-slate-100"></div>
                        <div className="w-2 h-2 rounded-sm bg-green-500"></div>
                    </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1.5">
                    {/* Weekday Labels */}
                    {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                        <div key={d} className="text-[8px] text-center text-slate-300 font-bold mb-1">{d}</div>
                    ))}
                    
                    {/* Padding for first week */}
                    {padding.map((_, i) => (
                        <div key={`p-${i}`} className="aspect-square"></div>
                    ))}
                    
                    {/* Actual Days */}
                    {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isTrainingDay = (data.monthlyTrainingDays || []).includes(dateStr);
                        const isToday = isSameDay(day, targetDate);
                        
                        return (
                            <div 
                                key={dateStr} 
                                className={`aspect-square rounded-[3px] transition-all relative ${
                                    isTrainingDay ? 'bg-green-500 scale-110 shadow-sm shadow-green-200' : 'bg-slate-100'
                                } ${isToday ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                            >
                                {isToday && (
                                    <div className="absolute top-[-2px] right-[-2px] w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Simple Stats Bar */}
            <div className="flex justify-around border-y border-slate-100 py-4 mt-2">
                <div className="text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Volume</p>
                    <p className="text-base font-black text-slate-800 tracking-tight">{Math.round(data.totalVolume/1000)}k <span className="text-[8px] text-slate-400">kg</span></p>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Sets</p>
                    <p className="text-base font-black text-slate-800 tracking-tight">{data.totalSets} <span className="text-[8px] text-slate-400">sets</span></p>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Duration</p>
                    <p className="text-base font-black text-slate-800 tracking-tight">{data.durationMinutes} <span className="text-[8px] text-slate-400">min</span></p>
                </div>
            </div>

             {/* Footer with QR */}
             <div className="flex items-center justify-between mt-auto pt-4">
                <div className="max-w-[180px]">
                    <h5 className="text-[10px] font-bold text-slate-800 leading-tight mb-1">训练使我变强。</h5>
                    <p className="text-[9px] text-slate-400 leading-normal">
                        扫码查看我的训练明细，开启你的进化之路。
                    </p>
                </div>
                <div className="p-1.5 border border-slate-100 rounded-lg bg-white overflow-hidden shrink-0">
                    <QRCodeSVG value={shareUrl} size={42} level="M" />
                </div>
            </div>
        </div>
    );
};

export default TemplateCalendar;
