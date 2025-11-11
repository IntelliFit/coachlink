'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CoachDashboardProps, CoachStudentItem, Student } from '@/types/coach';
import { coachService } from '@/app/dashboard/service/coachService';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';

// PrimeReact imports
import { TabMenu } from 'primereact/tabmenu';
import { MenuItem } from 'primereact/menuitem';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const router = useRouter();
    const pathname = usePathname();

    const items: MenuItem[] = [
        { label: '概览', icon: 'pi pi-home' },
        { label: '视频点评', icon: 'pi pi-video' },
        { label: '我的学员', icon: 'pi pi-users' },
        { label: '内容管理', icon: 'pi pi-book' },
        { label: '聊天管理', icon: 'pi pi-comments' }
    ];

    const [activeIndex, setActiveIndex] = useState(0);
    const [students, setStudents] = useState<Student[]>([]);

    // 根据当前路径设置活动标签
    useEffect(() => {
        if (pathname.includes('/dashboard/overview')) {
            setActiveIndex(0);
        } else if (pathname.includes('/dashboard/videos')) {
            setActiveIndex(1);
        } else if (pathname.includes('/dashboard/students')) {
            setActiveIndex(2);
        } else if (pathname.includes('/dashboard/content')) {
            setActiveIndex(3);
        } else if (pathname.includes('/dashboard/chat')) {
            setActiveIndex(4);
        } else {
            setActiveIndex(0);
        }
    }, [pathname]);


    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {/* 导航标签 */}
                    <TabMenu 
                        model={items} 
                        activeIndex={activeIndex} 
                        onTabChange={(e) => {
            setActiveIndex(e.index);
            // 使用Next.js的路由而不是浏览器默认行为
            const urls = [
                '/dashboard/overview',
                '/dashboard/videos', 
                '/dashboard/students',
                '/dashboard/content',
                '/dashboard/chat'
            ];
            router.push(urls[e.index]);
        }} 
                        className="shadow-sm rounded-lg"
                    />

                    {/* 子路由内容 */}
                    <div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardLayout;