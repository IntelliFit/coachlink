'use client';

import React, { useState, useEffect } from 'react';
import { TabView, TabPanel, TabViewTabChangeEvent } from 'primereact/tabview';
import CoachAboutPanel from './content-panel/About';
import CoachContentPanel from './content-panel/Content';
import CoachReviewsPanel from './content-panel/Reviews';
import { useSearchParams } from 'next/navigation';
import { CoachesRow } from '@/types';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';


interface CoachContentProps {
    coach: CoachesRow;
    coachId: string;
    userSubscription: QueryCoachSubscription | null;
    onSubscribeSuccess: () => void;
    activeTab: number;
    onTabChange: (tab: number) => void;
}

const CoachContent: React.FC<CoachContentProps> = ({
    coach,
    coachId,
    userSubscription,
    onSubscribeSuccess,
    activeTab,
    onTabChange
}) => {
    const searchParams = useSearchParams();
    const handleTabChange = (e: TabViewTabChangeEvent) => {
        onTabChange(e.index);
        // searchParams 中设置
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', e.index.toString());
    };

    return (
        <div className="max-w-7xl mx-auto">
            <TabView activeIndex={activeTab} onTabChange={handleTabChange}>
                <TabPanel header="关于教练">
                    <CoachAboutPanel coach={coach} />
                </TabPanel>
                <TabPanel header="教学内容">
                    <CoachContentPanel
                        coachId={coachId}
                        userSubscription={userSubscription}
                        onSubscribeSuccess={onSubscribeSuccess}
                    />
                </TabPanel>
                <TabPanel header="学员评价">
                    <CoachReviewsPanel
                        coachId={coachId}
                        userSubscription={userSubscription}
                    />
                </TabPanel>
            </TabView>
        </div>
    );
};

export default CoachContent;