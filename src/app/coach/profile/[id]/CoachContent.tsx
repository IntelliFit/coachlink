'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TabPanel, TabView, type TabViewTabChangeEvent } from 'primereact/tabview';
import type { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import type { CoachesRow } from '@/types';
import CoachSubscription from './CoachSubscription';
import CoachAboutPanel from './content-panel/About';
import CoachContentPanel from './content-panel/Content';
import CoachReviewsPanel from './content-panel/Reviews';

interface CoachContentProps {
    coach: CoachesRow;
    coachId: string;
    userSubscription: QueryCoachSubscription | null;
    mySubscriptions: QueryCoachSubscription[];
    aggregatedInfo: GetAggregatedInfoResponseDto;
    onSubscribeSuccess: (tier?: number) => void;
    activeTab: number;
    onTabChange: (tab: number) => void;
}

const CoachContent: React.FC<CoachContentProps> = ({
    coach,
    coachId,
    userSubscription,
    mySubscriptions,
    aggregatedInfo,
    onSubscribeSuccess,
    activeTab,
    onTabChange,
}) => {
    const searchParams = useSearchParams();
    const [visitedTabs, setVisitedTabs] = useState<number[]>(() => Array.from(new Set([0, activeTab])));

    useEffect(() => {
        setVisitedTabs((current) => (
            current.includes(activeTab) ? current : [...current, activeTab]
        ));
    }, [activeTab]);

    const loadedTabs = useMemo(() => {
        return new Set(visitedTabs);
    }, [visitedTabs]);

    const handleTabChange = (event: TabViewTabChangeEvent) => {
        onTabChange(event.index);

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', event.index.toString());
            const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', nextUrl);
        }
    };

    return (
        <div id="coach-profile-tabs" className="mx-auto min-h-screen max-w-7xl overflow-hidden rounded-2xl">
            <TabView activeIndex={activeTab} onTabChange={handleTabChange} scrollable>
                <TabPanel header="关于教练">
                    {loadedTabs.has(0) ? <CoachAboutPanel coach={coach} /> : null}
                </TabPanel>
                <TabPanel header="订阅价格">
                    {loadedTabs.has(1) ? (
                        <CoachSubscription
                            coach={coach}
                            mySubscriptions={mySubscriptions}
                            onSubscribeSuccess={(tier) => onSubscribeSuccess(tier)}
                        />
                    ) : null}
                </TabPanel>
                <TabPanel header={`教练专栏(${aggregatedInfo?.contentCount || 0})`}>
                    {loadedTabs.has(2) ? (
                        <CoachContentPanel
                            coachId={coachId}
                            userSubscription={userSubscription}
                            onSubscribeSuccess={onSubscribeSuccess}
                        />
                    ) : null}
                </TabPanel>
                <TabPanel header={`学员评价(${aggregatedInfo?.reviewCount || 0})`}>
                    {loadedTabs.has(3) ? (
                        <CoachReviewsPanel
                            coachId={coachId}
                            userSubscription={userSubscription}
                        />
                    ) : null}
                </TabPanel>
            </TabView>
        </div>
    );
};

export default CoachContent;
