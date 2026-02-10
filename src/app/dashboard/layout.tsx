'use client';

import React from 'react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-0 py-6 sm:py-8 space-y-8">
                {/* 子页面内容 */}
                <div>{children}</div>
            </div>
        </div>
    );
};

export default DashboardLayout;
