'use client';

import React, { useState } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';

export default function CoachPage() {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <div className="flex min-h-screen flex-col p-4 md:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl md:text-3xl font-bold">教练</h1>
                    </div>

                    <div className="p-card p-component rounded-lg border">
                        <div className="p-card-body">
                            <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
                                <TabPanel header="我的订阅">
                                    <div className="py-4">
                                        <p>我的订阅内容将在这里显示</p>
                                    </div>
                                </TabPanel>
                                <TabPanel header="发现教练">
                                    <div className="py-4">
                                        <p>发现教练功能将在这里实现</p>
                                    </div>
                                </TabPanel>
                            </TabView>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}