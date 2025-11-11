'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Users, Award, ArrowRight, MapPin, Clock, Crown, Eye } from 'lucide-react';
import { Coach } from '@/types/coach';
import { coachService } from '@/app/dashboard/service/coachService';

interface CoachDiscoveryPageProps {
    onSelectCoach: (coachId: string) => void;
    onBack: () => void;
}

const CoachDiscoveryPage: React.FC<CoachDiscoveryPageProps> = ({
    onSelectCoach,
    onBack
}) => {
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const list = await coachService.getAllCoaches();
                setCoaches(list as any);
            } catch (e) {
                console.error(e);
                setError('加载教练列表失败');
                setCoaches([]);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const filteredCoaches = coaches.filter(coach => {
        const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coach.bio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coach.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesSpecialty = selectedSpecialty === 'all' ||
            coach.specialties.includes(selectedSpecialty);

        return matchesSearch && matchesSpecialty;
    });

    const allSpecialties = Array.from(new Set(coaches.flatMap(coach => coach.specialties || [])));

    const renderCoachCard = (coach: Coach) => (
        <div
            key={coach.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectCoach(coach.id)}
        >
            {coach.is_featured && (
                <div className="flex items-center space-x-2 mb-4">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-700">精选教练</span>
                </div>
            )}

            <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {coach.avatar_url ? (
                        <img
                            src={coach.avatar_url}
                            alt={coach.name}
                            className="w-16 h-16 rounded-full object-cover"
                        />
                    ) : (
                        <span className="text-xl font-bold text-blue-600">
                            {coach.name.charAt(0)}
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{coach.name}</h3>
                        <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium text-gray-700">{coach.rating}</span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{coach.title}</p>

                    <div className="flex flex-wrap gap-1 mb-3">
                        {coach.specialties.map((specialty, index) => (
                            <span
                                key={index}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                            >
                                {specialty}
                            </span>
                        ))}
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{coach.bio}</p>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                                <Users className="w-4 h-4" />
                                <span>{coach.total_students}学员</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{coach.years_experience}年经验</span>
                            </div>
                        </div>

                        {typeof coach.subscription_price_tier1 === 'number' && (
                            <div className="text-right">
                                <div className="text-sm text-gray-500">起价</div>
                                <div className="text-lg font-bold text-blue-600">
                                    ¥{coach.subscription_price_tier1}/月
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0">
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* 头部 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">发现教练</h1>
                            <p className="text-gray-600 mt-1">找到最适合你的专业健身教练</p>
                        </div>
                        <button
                            onClick={onBack}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            ← 返回
                        </button>
                    </div>

                    {/* 搜索和筛选 */}
                    <div className="flex space-x-4">
                        <div className="flex-1 relative">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索教练姓名、专长或介绍..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <select
                            value={selectedSpecialty}
                            onChange={(e) => setSelectedSpecialty(e.target.value)}
                            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-40"
                        >
                            <option value="all">所有专长</option>
                            {allSpecialties.map((specialty) => (
                                <option key={specialty} value={specialty}>
                                    {specialty}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 教练列表 */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-gray-500 mt-4">加载教练列表...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
                            <p className="text-gray-600">稍后再试或刷新页面</p>
                        </div>
                    ) : filteredCoaches.length === 0 ? (
                        <div className="text-center py-12">
                            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">没有找到教练</h3>
                            <p className="text-gray-600">
                                {searchTerm || selectedSpecialty !== 'all'
                                    ? '请尝试调整搜索条件'
                                    : '暂无可用教练'
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-gray-500 mb-4">
                                找到 {filteredCoaches.length} 位教练
                            </div>
                            {filteredCoaches.map(renderCoachCard)}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoachDiscoveryPage;