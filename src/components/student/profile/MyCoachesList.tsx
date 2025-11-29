import React from 'react';
import { Users, ChevronRight, Star } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { ProfileData } from './types';

interface MyCoachesListProps {
    data: ProfileData;
}

export const MyCoachesList: React.FC<MyCoachesListProps> = ({ data }) => {
    const { coachesData } = data;
    const router = useRouter();

    if (!coachesData || coachesData.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Users className="text-indigo-600" size={20} />
                    我的教练
                </h2>
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-500 mb-4">暂无订阅的教练</p>
                    <Button 
                        label="发现教练" 
                        icon="pi pi-search" 
                        size="small" 
                        onClick={() => router.push('/coach/discovery')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Users className="text-indigo-600" size={20} />
                    我的教练
                </h2>
                <Button 
                    label="发现更多" 
                    icon="pi pi-arrow-right" 
                    iconPos="right"
                    link 
                    className="p-0"
                    onClick={() => router.push('/coach/discovery')}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coachesData.map((coach) => (
                    <div key={coach.id} className="p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow bg-gray-50">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <Avatar 
                                    image={coach.avatarUrl || undefined} 
                                    label={!coach.avatarUrl ? coach.name.charAt(0) : undefined}
                                    shape="circle" 
                                    size="large"
                                    className="bg-indigo-100 text-indigo-600 font-bold"
                                />
                                <div>
                                    <h3 className="font-bold text-gray-900">{coach.name}</h3>
                                    <p className="text-xs text-gray-500">{coach.title || '专业教练'}</p>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                                coach.subscriptionStatus === 'active' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                                {coach.subscriptionStatus === 'active' ? '服务中' : '已过期'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                <span>{coach.subscriptionTier === 1 ? '基础版' : coach.subscriptionTier === 2 ? '进阶版' : '尊享版'}</span>
                            </div>
                            <div className="text-gray-500 text-xs">
                                到期: {coach.subscriptionEndDate}
                            </div>
                        </div>

                        <Button 
                            label="查看主页" 
                            className="w-full mt-4 p-button-sm p-button-outlined" 
                            onClick={() => router.push(`/coach/profile/${coach.id}`)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
