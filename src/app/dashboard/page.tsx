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
    const router = useRouter();
    
    // 确保Hooks调用顺序固定，将所有Hooks放在组件开始处
    const coach = getCoach(session);

    const onBack = () => {
        // 跳转到主页
        router.push('/');
    };

    // 页面加载后直接重定向到概览页面
    useEffect(() => {
        if (status !== 'loading' && session) {
            router.push('/dashboard/overview');
        }
    }, [status, session, router]);

    if (status === 'loading') {
        return <div>加载中...</div>;
    }

    if (!session) {
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen">
        </div>
    );
};

export default CoachDashboard;