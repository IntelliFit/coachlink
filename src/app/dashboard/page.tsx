'use client';

import React, { useEffect } from 'react';
import { ArrowLeft, User, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CoachDashboardProps } from '@/types/coach';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';

// PrimeReact imports
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';

const CoachDashboard: React.FC<CoachDashboardProps> = () => {
    const { data: session, status } = useSession();
    const coach = getCoach(session);
    const router = useRouter();

    const onBack = () => {
        // 跳转到主页
        router.push('/');
    };

    if (status === 'loading') {
        return <div>加载中...</div>;
    }

    if (!session) {
        router.push('/login');
        return null;
    }

    // 页面加载后直接重定向到概览页面
    useEffect(() => {
        router.push('/dashboard/overview');
    }, [router]);

    return (
        <div className="min-h-screen">
            {/* 头部 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <Button 
                            icon="pi pi-arrow-left" 
                            className="p-button-rounded p-button-text" 
                            onClick={onBack}
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-900">教练管理台</h1>
                            <p className="text-600">欢迎回来，{coach?.name}！</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <Button 
                            icon="pi pi-bell" 
                        >
                            <Badge value="8"></Badge>
                        </Button>
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 默认重定向到概览页面 */}
        </div>
    );
};

export default CoachDashboard;