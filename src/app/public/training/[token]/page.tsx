'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Trophy, Clock, Target } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const PublicTrainingPage = () => {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/public/training?token=${token}`);
            const json = await res.json();
            
            if (json.success) {
                setData(json.data);
            } else {
                setError(json.message || '获取训练信息失败');
            }
        } catch (err) {
            setError('网络请求失败');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <ProgressSpinner />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 p-4">
                <Card className="max-w-md w-full text-center">
                    <h2 className="text-xl font-bold text-red-500 mb-4">{error || '内容不可见'}</h2>
                    <Button label="回主页" onClick={() => router.push('/')} />
                </Card>
            </div>
        );
    }

    const dateStr = format(new Date(data.completedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

    return (
        <div className="min-h-screen bg-surface-50 pb-12">
            {/* Header / Banner */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 mb-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)]"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full border-4 border-white/20 p-1 bg-white/10 backdrop-blur-sm">
                            <div className="w-full h-full rounded-full overflow-hidden bg-surface-50">
                                {data.user.avatarUrl ? (
                                    <img src={data.user.avatarUrl} alt={data.user.nickname} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-surface-500">
                                        {data.user.nickname?.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">
                        {data.user.nickname} <span className="text-primary-400 font-medium">Training DONE</span>
                    </h1>
                    <p className="text-white/70 text-sm font-medium">
                        {dateStr} · {data.planName}
                    </p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4">
                {/* Stats Section */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Card className="text-center bg-surface-0 shadow-sm border border-surface-100/60">
                        <Trophy className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                        <p className="text-[10px] text-surface-400 font-bold uppercase mb-1">Volume</p>
                        <p className="text-xl font-black text-surface-900 tracking-tight">{Math.round(data.totalVolume/1000)}k <span className="text-xs text-surface-400">kg</span></p>
                    </Card>
                    <Card className="text-center bg-surface-0 shadow-sm border border-surface-100/60">
                        <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                        <p className="text-[10px] text-surface-400 font-bold uppercase mb-1">Sets</p>
                        <p className="text-xl font-black text-surface-900 tracking-tight">{data.totalSets} <span className="text-xs text-surface-400">sets</span></p>
                    </Card>
                    <Card className="text-center bg-surface-0 shadow-sm border border-surface-100/60">
                        <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                        <p className="text-[10px] text-surface-400 font-bold uppercase mb-1">Time</p>
                        <p className="text-xl font-black text-surface-900 tracking-tight">{data.durationMinutes} <span className="text-xs text-surface-400">min</span></p>
                    </Card>
                </div>

                {/* Exercises Detail */}
                <h3 className="text-lg font-bold text-surface-900 mb-4 px-2">训练明细</h3>
                <div className="space-y-3 mb-10">
                    {data.actionExecutions.map((action: any, idx: number) => (
                        <div key={idx} className="bg-surface-0 p-4 rounded-2xl shadow-sm border border-surface-100 flex justify-between items-center transform transition-all hover:scale-[1.01]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-50 flex items-center justify-center font-bold text-surface-500 text-sm">
                                    {idx + 1}
                                </div>
                                <h4 className="font-bold text-surface-900">{action.actionName}</h4>
                            </div>
                            <div className="text-right">
                                <span className="px-2 py-1 bg-primary-50 text-primary-600 rounded text-xs font-bold mr-2">
                                    {action.setsCount} 组
                                </span>
                                {action.volume > 0 && (
                                    <span className="text-surface-400 text-xs font-medium">
                                        总量 {action.volume}kg
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <Card className="bg-slate-900 border-0 text-white p-6 overflow-hidden relative">
                    <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-primary-500/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <h4 className="text-xl font-bold mb-2">想要同款训练计划？</h4>
                        <p className="text-white/70 text-sm mb-6">
                            加入 CoachLink，发现更多专业教练带你科学健身。
                        </p>
                        <div className="flex gap-4">
                            <Button label="立即加入" className="bg-primary-500 border-0 flex-1 py-3" onClick={() => router.push('/register')} />
                            <Button label="浏览计划" outlined className="border-white/20 text-white flex-1 py-3" onClick={() => router.push('/coach/discovery')} />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default PublicTrainingPage;
