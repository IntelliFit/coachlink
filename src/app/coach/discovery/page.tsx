'use client';

import React, { useState, useEffect } from 'react';
import { Star, Users, Clock, Crown, Eye } from 'lucide-react';
import { Paginator } from 'primereact/paginator';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { CoachesRow } from '@/types';
import { useRouter } from 'next/navigation';

const CoachDiscoveryPage: React.FC = () => {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [first, setFirst] = useState(0);
    const coachesPerPage = 10;
    const router = useRouter();

    const onSelectCoach = (coachId: string) => {
        console.log('selectedCoachId:', coachId);
        router.push('/coach/profile/' + coachId);
    };

    useEffect(() => {
        loadCoaches(1);
        loadSpecialties();
    }, []);

    const loadSpecialties = async () => {
        try {
            const specialtiesData = await coachService.getAllSpecialties();
            if (specialtiesData) {
                const formattedSpecialties = specialtiesData.map(specialty => ({
                    label: specialty.name,
                    value: specialty.name
                }));
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
            }
        } catch (e) {
            console.error('加载专长列表失败:', e);
        }
    };

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await coachService.getAllCoaches({
                page: page,
                limit: coachesPerPage,
                search: searchTerm || '',
                specialty: selectedSpecialty
            });
            if (res) {
                setCoaches(res.coaches);
                setTotalCount(res.count);
            } else {
                setCoaches([]);
                setTotalCount(0);
            }
        } catch (e) {
            console.error(e);
            setError('加载教练列表失败');
            setCoaches([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    const onSearchOrFilter = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await coachService.getAllCoaches({
                page: 1,
                limit: coachesPerPage,
                search: searchTerm || '',
                specialty: selectedSpecialty
            });
            if (res) {
                setCoaches(res.coaches);
                setTotalCount(res.count);
                setCurrentPage(0);
                setFirst(0);
            } else {
                setCoaches([]);
                setTotalCount(0);
            }
        } catch (e) {
            console.error(e);
            setError('加载教练列表失败');
            setCoaches([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    const onPageChange = (event: any) => {
        setCurrentPage(event.page);
        setFirst(event.first);
        loadCoaches(event.page + 1);
    };

    // 移除了客户端过滤，现在由服务端处理搜索和筛选

    const renderCoachCard = (coach: CoachesRow) => (
        <div
            key={coach.id}
            className="rounded-xl shadow-sm border border-surface-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectCoach(coach.id)}
        >
            {coach.is_featured && (
                <div className="flex items-center space-x-2 mb-4">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-700">精选教练</span>
                </div>
            )}

            <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {coach.avatar_url ? (
                        <img
                            src={coach.avatar_url}
                            alt={coach.name}
                            className="w-16 h-16 rounded-full object-cover"
                        />
                    ) : (
                        <span className="text-xl font-bold text-primary-600">
                            {coach.name.charAt(0)}
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-surface-900">{coach.name}</h3>
                        <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium text-surface-700">{coach.rating}</span>
                        </div>
                    </div>

                    <p className="text-sm text-surface-600 mb-2">{coach.title}</p>

                    <div className="flex flex-wrap gap-1 mb-3">
                        {coach.specialties?.map((specialty, index) => (
                            <span
                                key={index}
                                className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                            >
                                {specialty}
                            </span>
                        ))}
                    </div>

                    <p className="text-sm text-surface-600 mb-4 line-clamp-2">{coach.bio}</p>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-surface-500">
                            <div className="flex items-center space-x-1">
                                <Users className="w-4 h-4" />
                                <span>{coach.total_students}学员</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{coach.years_experience}年经验</span>
                            </div>
                        </div>

                        {typeof (coach as any).subscription_price_tier1 === 'number' && (
                            <div className="text-right">
                                <div className="text-sm text-surface-500">起价</div>
                                <div className="text-lg font-bold text-primary-600">
                                    ¥{(coach as any).subscription_price_tier1}/月
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-surface-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* 头部 */}
                <div className="rounded-xl mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-900">发现教练</h1>
                            <p className="text-surface-600 mt-1">找到最适合你的专业健身教练</p>
                        </div>
                    </div>

                    {/* 搜索和筛选 */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <IconField iconPosition="left">
                                <InputIcon className="pi pi-search"> </InputIcon>
                                <InputText
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="搜索教练姓名、专长或介绍..."
                                    className="w-full"
                                />
                            </IconField>
                        </div>

                        <div className="min-w-40">
                            <Dropdown
                                value={selectedSpecialty}
                                options={specialties}
                                onChange={(e) => setSelectedSpecialty(e.value)}
                                placeholder="选择专长"
                                className="w-full"
                            />
                        </div>

                        <Button
                            onClick={onSearchOrFilter}
                            label="搜索"
                            className="h-fit"
                        />
                    </div>
                </div>

                {/* 教练列表 */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="rounded-xl border border-surface-200 p-6 shadow-sm"
                                >
                                    <div className="flex items-start space-x-4">
                                        <Skeleton shape="circle" size="4rem" className="flex-shrink-0" />
                                        <div className="flex-1 space-y-3">
                                            <div className="flex justify-between">
                                                <Skeleton width="40%" height="1rem" />
                                                <Skeleton width="20%" height="1rem" />
                                            </div>
                                            <Skeleton width="60%" height="0.75rem" />
                                            <div className="flex gap-2">
                                                <Skeleton width="20%" height="1.25rem" borderRadius="9999px" />
                                                <Skeleton width="15%" height="1.25rem" borderRadius="9999px" />
                                                <Skeleton width="10%" height="1.25rem" borderRadius="9999px" />
                                            </div>
                                            <Skeleton width="100%" height="2.5rem" />
                                            <div className="flex justify-between items-center mt-3">
                                                <div className="flex space-x-4">
                                                    <Skeleton width="5rem" height="1rem" />
                                                    <Skeleton width="5rem" height="1rem" />
                                                </div>
                                                <Skeleton width="6rem" height="1.25rem" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <h3 className="text-lg font-medium text-surface-900 mb-2">{error}</h3>
                            <p className="text-surface-600">稍后再试或刷新页面</p>
                        </div>
                    ) : coaches.length === 0 ? (
                        <div className="text-center py-12">
                            <Eye className="w-16 h-16 text-surface-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-surface-900 mb-2">没有找到教练</h3>
                            <p className="text-surface-600">
                                {searchTerm || selectedSpecialty !== 'all'
                                    ? '请尝试调整搜索条件'
                                    : '暂无可用教练'
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-surface-500 mb-4">
                                找到 {totalCount} 位教练
                            </div>
                            {coaches.map(renderCoachCard)}

                            {/* 分页器 */}
                            <Paginator
                                first={first}
                                rows={coachesPerPage}
                                totalRecords={totalCount}
                                onPageChange={onPageChange}
                                className="mt-6"
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoachDiscoveryPage;