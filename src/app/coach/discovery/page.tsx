'use client';

import React, { useState, useEffect } from 'react';
import { Star, Users, Clock, Crown, Eye, Search, ArrowRight, Shield, UserCheck } from 'lucide-react';
import { Paginator } from 'primereact/paginator';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { CoachesRow } from '@/types';
import { useRouter } from 'next/navigation';
import { useGuideStore } from '@/stores/useGuideStore';

interface VisibilityStatus {
    focusMode: boolean;
    focusCoachId: string | null;
    focusCoachName: string | null;
    referrerCoachId: string | null;
    referrerCoachName: string | null;
}

const CoachDiscoveryPage: React.FC = () => {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [totalCount, setTotalCount] = useState(0);
    const [first, setFirst] = useState(0);
    const coachesPerPage = 10;
    const router = useRouter();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading, isInitialized: isGuideInitialized } = useGuideStore();

    // 视野状态
    const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus | null>(null);
    const [visibilityLoading, setVisibilityLoading] = useState(true);

    // 先获取视野状态
    useEffect(() => {
        const fetchVisibilityStatus = async () => {
            try {
                const res = await fetch('/api/student/visibility-status');
                const json = await res.json();
                if (json.success && json.data) {
                    setVisibilityStatus(json.data);
                }
            } catch (error) {
                console.error('获取视野状态失败:', error);
            } finally {
                setVisibilityLoading(false);
            }
        };
        fetchVisibilityStatus();
    }, []);

    useEffect(() => {
        if (visibilityLoading) return;
        loadCoaches(1);
        loadSpecialties();
    }, [visibilityLoading, visibilityStatus]);

    // Auto start guide once after list is available (action-oriented, not just nav overview)
    useEffect(() => {
        if (isLoading) return;
        if (!coaches || coaches.length === 0) return;
        if (isGuideLoading || !isGuideInitialized) return;
        if (hasCompletedGuide('student_find_coach')) return;
        // 专注模式下不显示发现教练的引导
        if (visibilityStatus?.focusMode) return;
        const t = setTimeout(() => startGuide('STUDENT_FIND_COACH_GUIDE'), 600);
        return () => clearTimeout(t);
    }, [isLoading, coaches, hasCompletedGuide, startGuide, isGuideLoading, isGuideInitialized, visibilityStatus]);

    const loadSpecialties = async () => {
        try {
            const specialtiesData = await coachService.getAllSpecialties();
            if (specialtiesData) {
                const formattedSpecialties = specialtiesData.map(specialty => ({
                    label: specialty.name, value: specialty.name
                }));
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
            }
        } catch (e) { console.error(e); }
    };

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        try {
            // 如果处于专注模式，只加载专注的教练
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
                if (res && res.coach) {
                    setCoaches([res.coach as CoachesRow]);
                    setTotalCount(1);
                } else {
                    setCoaches([]);
                    setTotalCount(0);
                }
            } else {
                const res = await coachService.getAllCoaches({
                    page: page, limit: coachesPerPage,
                    search: searchTerm || '', specialty: selectedSpecialty
                });
                if (res) {
                    setCoaches(res.coaches);
                    setTotalCount(res.count);
                }
            }
        } finally { setIsLoading(false); }
    };

    const onSearchOrFilter = () => {
        setFirst(0);
        loadCoaches(1);
    };

    const renderCoachCard = (coach: CoachesRow & { studentCount?: number; averageRating?: number }, idx: number) => (
        <div
            key={coach.id}
            id={idx === 0 ? "guide-discovery-first-coach" : undefined}
            className="group bg-surface-0 rounded-lg p-5 mb-4 transition-all hover:shadow-md border border-surface-100 cursor-pointer"
            onClick={() => router.push('/coach/profile/' + coach.id + '?from=discovery')}
        >
            <div className="flex flex-col md:flex-row gap-5">
                {/* 头像 */}
                <div className="relative flex-shrink-0 mx-auto md:mx-0">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-50 border border-surface-100">
                        {coach.avatar_url ? (
                            <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-primary-500">
                                {coach.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    {coach.is_featured && (
                        <div className="absolute -top-2 -left-2 bg-amber-400 text-white p-1 rounded-md shadow-sm">
                            <Crown size={12} fill="currentColor" />
                        </div>
                    )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-surface-900">{coach.name}</h3>
                            <span className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                                <Star size={14} fill="currentColor" />
                                {typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : (coach.rating ?? '0.0')}
                            </span>
                        </div>
                        {typeof (coach as any).subscription_price_tier1 === 'number' && (
                            <div className="text-right">
                                <span className="text-xs text-surface-400 block">月度起价</span>
                                <span className="text-lg font-bold text-primary-600">¥{(coach as any).subscription_price_tier1}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                        {coach.specialties?.slice(0, 3).map((spec, i) => (
                            <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs font-medium rounded border border-primary-100">
                                {spec}
                            </span>
                        ))}
                    </div>

                    <p className="text-surface-500 text-sm mb-4 line-clamp-1">
                        {coach.bio || "暂无教练简介"}
                    </p>

                    <div className="flex items-center gap-4 text-surface-400 text-xs font-medium">
                        <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{coach.total_students || 0} 位学员</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>{coach.years_experience || 0} 年教学经验</span>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center text-surface-300 group-hover:text-primary-500 transition-colors">
                    <ArrowRight size={20} />
                </div>
            </div>
        </div>
    );

    // 专注模式下显示不同的界面
    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen bg-surface-50/50 py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    {/* 专属教练头部 */}
                    <header className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-50 rounded-lg">
                                <UserCheck className="text-primary-500" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-surface-900 tracking-tight">我的专属教练</h1>
                                <p className="text-surface-500 text-sm mt-1 font-medium">
                                    您通过 {visibilityStatus.focusCoachName || '教练'} 的邀请加入平台
                                </p>
                            </div>
                        </div>

                        {/* 专属模式提示 */}
                        <div className="mt-4 p-4 bg-primary-50 border border-primary-100 rounded-lg flex items-start gap-3">
                            <Shield className="text-primary-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-medium text-primary-700">专属服务模式</p>
                                <p className="text-xs text-primary-600 mt-1">
                                    您当前处于专属服务期间，可以专注享受教练为您提供的个性化训练服务。订阅结束后可浏览更多教练。
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* 教练卡片 */}
                    {isLoading || visibilityLoading ? (
                        <div className="bg-surface-0 rounded-lg p-6 border border-surface-100">
                            <div className="flex gap-4">
                                <Skeleton shape="rectangle" size="5rem" className="rounded-lg shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <Skeleton width="30%" height="1.2rem" />
                                    <Skeleton width="100%" height="2rem" />
                                </div>
                            </div>
                        </div>
                    ) : coaches.length > 0 ? (
                        coaches.map((c, idx) => renderCoachCard(c as any, idx))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-surface-0 rounded-lg border border-surface-100">
                            <Eye size={40} className="text-surface-200 mb-3" />
                            <p className="text-surface-500 font-bold">教练信息加载失败</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 正常模式 - 发现教练
    return (
        <div className="min-h-screen bg-surface-50/50 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* 头部标题区 */}
                <header className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">发现教练</h1>
                            <p className="text-surface-500 text-sm mt-1 font-medium">找到最适合你的专业健身伙伴</p>
                        </div>
                        <Button
                            icon="pi pi-question-circle"
                            label="新手引导"
                            outlined
                            size="small"
                            onClick={() => startGuide('STUDENT_FIND_COACH_GUIDE')}
                            className="shrink-0"
                        />
                    </div>

                    {/* 搜索与筛选区域 */}
                    <div className="mt-6 flex flex-col md:flex-row gap-3 p-2 bg-surface-0 rounded-lg shadow-sm border border-surface-100">
                        <div id="guide-discovery-search" className="flex-1 relative flex items-center">
                            <Search className="absolute left-3 text-surface-400" size={18} />
                            <InputText
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索姓名或专长..."
                                className="w-full pl-10 border-none shadow-none bg-transparent py-2.5 text-surface-700"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <div id="guide-discovery-filter">
                                <Dropdown
                                    value={selectedSpecialty}
                                    options={specialties}
                                    onChange={(e) => setSelectedSpecialty(e.value)}
                                    // 核心修复：垂直居中问题
                                    pt={{
                                        root: { className: 'w-full md:w-44 bg-surface-50 border-none rounded-lg flex items-center' },
                                        input: { className: 'flex items-center py-2 px-3 text-sm font-medium text-surface-600' },
                                        trigger: { className: 'w-10 flex items-center justify-center' }
                                    }}
                                />
                            </div>
                            <Button
                                onClick={onSearchOrFilter}
                                label="搜索"
                                className="bg-primary-500 border-none px-6 py-2.5 rounded-lg font-bold text-white shadow-sm hover:bg-primary-600"
                            />
                        </div>
                    </div>
                </header>

                <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                        共找到 {totalCount} 位教练
                    </div>
                </div>

                {/* 列表内容 */}
                {isLoading || visibilityLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface-0 rounded-lg p-6 border border-surface-100">
                                <div className="flex gap-4">
                                    <Skeleton shape="rectangle" size="5rem" className="rounded-lg shrink-0" />
                                    <div className="flex-1 space-y-3">
                                        <Skeleton width="30%" height="1.2rem" />
                                        <Skeleton width="100%" height="2rem" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : coaches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface-0 rounded-lg border border-surface-100">
                        <Eye size={40} className="text-surface-200 mb-3" />
                        <p className="text-surface-500 font-bold">没有找到教练</p>
                    </div>
                ) : (
                    <>
                        {coaches.map((c, idx) => renderCoachCard(c as any, idx))}
                        <Paginator
                            first={first}
                            rows={coachesPerPage}
                            totalRecords={totalCount}
                            onPageChange={(e) => { setFirst(e.first); loadCoaches(e.page + 1); }}
                            className="bg-transparent border-none py-8"
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default CoachDiscoveryPage;