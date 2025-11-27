'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { TabMenu } from 'primereact/tabmenu';
import type { MenuItem } from 'primereact/menuitem';
import type { TabMenuTabChangeEvent } from 'primereact/tabmenu';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* 子页面内容 */}
                <div>{children}</div>
            </div>
        </div>
    );
};

export default DashboardLayout;
