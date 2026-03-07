'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Star, Users, Crown, Search, ArrowLeft, MapPin } from 'lucide-react';
import { Paginator } from 'primereact/paginator';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { CoachesRow } from '@/types';
import { useRouter } from 'next/navigation';
import { useUserLocation } from '@/hooks/useUserLocation';
import { formatCoachDistance, isSameCounty } from '@/lib/distanceUtils';

const CoachSearchPage: React.FC = () => {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [sameCityOnly, setSameCityOnly] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const coachesPerPage = 12;
    const router = useRouter();
    const { userLocation } = useUserLocation();

    // 搜索防抖
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // 加载专长列表
    useEffect(() => {
        loadSpecialties();
    }, []);

    // 当搜索词或筛选条件变化时，重置到第一页并加载数据
    useEffect(() => {
        setCurrentPage(0);
        loadCoaches(1);
    }, [debouncedSearchTerm, selectedSpecialty]);

    // 只看同城：对当前页结果做客户端过滤（区/县与用户一致）
    const filteredCoaches = useMemo(() => {
        if (!sameCityOnly) return coaches;
        return coaches.filter((c) => isSameCounty(userLocation, c));
    }, [coaches, sameCityOnly, userLocation]);

    const loadSpecialties = async () => {
        try {
            // 从实际教练数据中获取使用的专长，按频率排序
            const specialtiesList = await coachService.getUsedSpecialties();
            if (specialtiesList && specialtiesList.length > 0) {
                const formattedSpecialties = specialtiesList.map(specialty => ({
                    label: specialty, value: specialty
                }));
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
            } else {
                // 如果没有找到实际使用的专长，回退到所有专长列表
                const specialtiesData = await coachService.getAllSpecialties();
                if (specialtiesData) {
                    const formattedSpecialties = specialtiesData.map(specialty => ({
                        label: specialty.name, value: specialty.name
                    }));
                    setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
                }
            }
        } catch (e) { 
            console.error('加载专长失败:', e); 
        }
    };

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        try {
            const res = await coachService.getAllCoaches({
                page: page,
                limit: coachesPerPage,
                search: debouncedSearchTerm || '',
                specialty: selectedSpecialty === 'all' ? '' : selectedSpecialty
            });
            if (res) {
                setCoaches(res.coaches);
                setTotalCount(res.count || 0);
            }
        } catch (e) {
            console.error('加载教练失败:', e);
            setCoaches([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    const onPageChange = (event: any) => {
        setCurrentPage(event.page);
        loadCoaches(event.page + 1);
    };

    // 教练卡片渲染
    const renderCoachCard = (coach: CoachesRow & { studentCount?: number; averageRating?: number }) => (
        <div
            key={coach.id}
            className="bg-surface-0 rounded-2xl p-4 border border-surface-100 hover:border-primary-200 transition-all cursor-pointer"
            onClick={() => router.push('/coach/profile/' + coach.id + '?from=search')}
        >
            <div className="relative w-full aspect-square mb-3 rounded-xl overflow-hidden bg-surface-50">
                {coach.avatar_url ? (
                    <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-surface-300 bg-surface-100">
                        {coach.name.charAt(0)}
                    </div>
                )}
                {coach.is_featured && (
                    <div className="absolute top-2 right-2 bg-amber-400 text-white p-1.5 rounded-lg">
                        <Crown size={12} fill="currentColor" />
                    </div>
                )}
            </div>
            
            <h3 className="text-base font-bold text-surface-900 truncate mb-1">{coach.name}</h3>
            <p className="text-sm text-surface-500 line-clamp-2 mb-3 min-h-[2.5em]">{coach.bio || "暂无简介"}</p>
            
            <div className="flex items-center gap-1 text-xs text-surface-400 mb-3">
                <Star size={12} className="text-amber-500 fill-amber-500" />
                <span className="font-bold text-surface-700">
                    {typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : (coach.rating ?? '0.0')}
                </span>
                <span className="w-1 h-1 bg-surface-300 rounded-full mx-1"></span>
                <Users size={12} />
                <span>{coach.studentCount || 0} 学员</span>
            </div>

            <div className="flex items-end justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 min-w-0">
                    {coach.specialties?.slice(0, 3).map((spec, i) => (
                        <span 
                            key={i} 
                            className="px-2 py-1 bg-surface-50 text-surface-600 text-xs rounded-md border border-surface-100"
                        >
                            {spec}
                        </span>
                    ))}
                    {coach.specialties && coach.specialties.length > 3 && (
                        <span className="px-2 py-1 bg-surface-50 text-surface-500 text-xs rounded-md border border-surface-100">
                            +{coach.specialties.length - 3}
                        </span>
                    )}
                </div>
                {formatCoachDistance(userLocation, coach) && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isSameCounty(userLocation, coach) && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-black rounded-full border border-primary-200">
                                同城
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-bold text-primary-600">
                            <MapPin size={12} className="text-primary-500 shrink-0" />
                            {formatCoachDistance(userLocation, coach)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-surface-50/50 pb-20">
            {/* 顶部搜索区 */}
            <div className="bg-surface-0 sticky top-0 z-30 pt-safe-top border-b border-surface-100">
                <div className="px-4 py-4 max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-xl font-bold text-surface-900">搜索教练</h1>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <InputText
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setDebouncedSearchTerm(searchTerm);
                                    }
                                }}
                                placeholder="搜索教练名字或专长"
                                className="w-full pl-10 h-10 rounded-full border-none bg-surface-100 focus:ring-2 focus:ring-primary-500/20 text-sm"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <Dropdown
                                value={selectedSpecialty}
                                options={specialties}
                                onChange={(e) => setSelectedSpecialty(e.value)}
                                placeholder="选择专长"
                                className="w-full h-10 rounded-full border-none bg-surface-100"
                                panelClassName="rounded-xl"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setSameCityOnly((v) => !v)}
                            className={`shrink-0 h-10 px-4 rounded-full border text-sm font-bold transition-colors flex items-center gap-1.5 ${
                                sameCityOnly
                                    ? 'bg-primary-100 border-primary-300 text-primary-700'
                                    : 'bg-surface-100 border-surface-200 text-surface-600 hover:bg-surface-200'
                            }`}
                        >
                            <MapPin size={16} className="shrink-0" />
                            只看同城
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-6">
                {/* 结果统计 */}
                {!isLoading && (
                    <div className="mb-4 text-sm text-surface-500">
                        {sameCityOnly ? (
                            userLocation ? (
                                <>本页 <span className="font-bold text-primary-600">{filteredCoaches.length}</span> 位同城教练</>
                            ) : (
                                <>开启定位后可筛选同城教练 · 共 <span className="font-bold text-surface-700">{totalCount}</span> 位教练</>
                            )
                        ) : (
                            <>找到 <span className="font-bold text-surface-700">{totalCount}</span> 位教练</>
                        )}
                    </div>
                )}

                {/* 教练网格 */}
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: coachesPerPage }).map((_, i) => (
                            <div key={i} className="bg-surface-0 rounded-2xl p-4 border border-surface-100">
                                <Skeleton width="100%" height="200px" className="mb-3 rounded-xl" />
                                <Skeleton width="80%" height="20px" className="mb-2" />
                                <Skeleton width="100%" height="40px" className="mb-3" />
                                <Skeleton width="60%" height="16px" className="mb-3" />
                                <Skeleton width="100%" height="24px" />
                            </div>
                        ))}
                    </div>
                ) : coaches.length > 0 ? (
                    <>
                        {filteredCoaches.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                                {filteredCoaches.map(coach => renderCoachCard(coach as any))}
                            </div>
                        ) : sameCityOnly ? (
                            <div className="w-full py-12 text-center mb-6">
                                <p className="text-surface-500 text-sm mb-1">本页暂无同城教练</p>
                                <p className="text-surface-400 text-xs">试试切换搜索条件或取消「只看同城」</p>
                            </div>
                        ) : null}
                        
                        {/* 分页 */}
                        {totalCount > coachesPerPage && (
                            <div className="flex justify-center">
                                <Paginator
                                    first={currentPage * coachesPerPage}
                                    rows={coachesPerPage}
                                    totalRecords={totalCount}
                                    onPageChange={onPageChange}
                                    template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
                                    className="border-none"
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full py-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-100 rounded-full mb-4">
                            <Search size={24} className="text-surface-400" />
                        </div>
                        <p className="text-surface-400 text-sm mb-2">暂无匹配的教练</p>
                        <p className="text-surface-500 text-xs">试试调整搜索条件或筛选条件</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoachSearchPage;

