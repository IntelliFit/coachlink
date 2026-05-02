'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import type { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';
import type { CoachesRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';
import CoachIntroduction from './CoachIntroduction';
import CoachContent from './CoachContent';

const SUBSCRIBE_TAB_INDEX = 1;

const CoachProfilePage: React.FC = () => {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const coachId = Array.isArray(params.id) ? params.id[0] : params.id;
    const initialTab = Number.parseInt(searchParams.get('tab') || '0', 10);

    const [activeTab, setActiveTab] = useState<number>(Number.isNaN(initialTab) ? 0 : initialTab);
    const [mySubscriptions, setMySubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [userSubscription, setUserSubscription] = useState<QueryCoachSubscription | null>(null);
    const [aggregatedInfo, setAggregatedInfo] = useState<GetAggregatedInfoResponseDto | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    const goToSubscribeTab = useCallback(() => {
        setActiveTab(SUBSCRIBE_TAB_INDEX);

        if (typeof window !== 'undefined') {
            const nextParams = new URLSearchParams(window.location.search);
            nextParams.set('tab', String(SUBSCRIBE_TAB_INDEX));
            const nextUrl = `${window.location.pathname}?${nextParams.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', nextUrl);
        }

        const isInView = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.top <= window.innerHeight * 0.4;
        };

        const tryScroll = () => {
            const anchor =
                document.getElementById('choose-pricing') ||
                document.getElementById('coach-profile-tabs');
            if (!anchor) return false;

            if (activeTab === SUBSCRIBE_TAB_INDEX && isInView(anchor)) return true;

            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };

        let tries = 0;
        const loop = () => {
            if (tryScroll()) return;
            if (tries++ > 12) return;
            requestAnimationFrame(loop);
        };

        setTimeout(loop, 0);
    }, [activeTab]);

    const initAggregatedInfo = useCallback(async () => {
        if (!coachId) return;

        try {
            setLoadingProfile(true);
            const result = await coachService.getAggregatedInfo({ coachId: coachId.toString() });
            if (result) {
                setAggregatedInfo(result);
            } else {
                showToast({ severity: 'error', summary: '获取教练信息失败' });
            }
        } catch (error) {
            console.error('获取教练聚合信息失败:', error);
            showToast({ severity: 'error', summary: '获取教练信息失败' });
        } finally {
            setLoadingProfile(false);
        }
    }, [coachId, showToast]);

    const initSubscriptions = useCallback(async () => {
        if (!session?.user?.id || !coachId) return;

        const result = await subscriptionService.getCoachSubscriptions({
            studentId: session.user.id,
            onlyActive: false,
        });

        if (result) {
            setMySubscriptions(result.subscriptions || []);
            setUserSubscription(result.subscriptions.find((sub) => sub.coach_id === coachId) || null);
        }
    }, [coachId, session?.user?.id]);

    useEffect(() => {
        if (!coachId) {
            router.replace('/coach');
        }
    }, [coachId, router]);

    useEffect(() => {
        const tabId = Number.parseInt(searchParams.get('tab') || '0', 10);
        setActiveTab(Number.isNaN(tabId) ? 0 : tabId);
    }, [searchParams]);

    useEffect(() => {
        void initAggregatedInfo();
    }, [initAggregatedInfo]);

    useEffect(() => {
        if (!session?.user?.id) {
            setMySubscriptions([]);
            setUserSubscription(null);
            return;
        }

        void initSubscriptions();
    }, [initSubscriptions, session?.user?.id]);

    const renderCoachSkeleton = () => (
        <div className="bg-surface animate-pulse">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-8 md:flex-row">
                    <div className="flex-shrink-0">
                        <div className="mb-4 h-32 w-32 rounded-full bg-surface-200" />
                        <div className="h-20 w-20 rounded-lg bg-surface-200" />
                    </div>

                    <div className="flex-1">
                        <div className="mb-4 h-8 w-1/3 rounded bg-surface-200" />
                        <div className="mb-6 h-6 w-1/4 rounded bg-surface-200" />

                        <div className="mb-6 flex space-x-4">
                            <div className="h-4 w-16 rounded bg-surface-200" />
                            <div className="h-4 w-16 rounded bg-surface-200" />
                            <div className="h-4 w-16 rounded bg-surface-200" />
                            <div className="h-4 w-16 rounded bg-surface-200" />
                        </div>

                        <div className="mb-6 space-y-3">
                            <div className="h-4 w-1/4 rounded bg-surface-200" />
                            <div className="flex space-x-2">
                                <div className="h-6 w-16 rounded-full bg-surface-200" />
                                <div className="h-6 w-20 rounded-full bg-surface-200" />
                                <div className="h-6 w-16 rounded-full bg-surface-200" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="h-4 w-1/4 rounded bg-surface-200" />
                            <div className="h-4 w-full rounded bg-surface-200" />
                            <div className="h-4 w-5/6 rounded bg-surface-200" />
                            <div className="h-4 w-4/6 rounded bg-surface-200" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (aggregatedInfo?.coach) {
        const displayCoach = aggregatedInfo.coach as CoachesRow;

        return (
            <div className="min-h-screen pb-24 md:pb-0">
                <CoachIntroduction
                    coach={displayCoach}
                    userSubscription={userSubscription}
                    aggregatedInfo={aggregatedInfo}
                    onGoToSubscribe={goToSubscribeTab}
                />

                <CoachContent
                    coach={displayCoach}
                    coachId={displayCoach.id}
                    userSubscription={userSubscription}
                    mySubscriptions={mySubscriptions}
                    aggregatedInfo={aggregatedInfo}
                    onSubscribeSuccess={(tier) => {
                        if (tier !== undefined) {
                            void initSubscriptions();
                        }
                    }}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                {session?.user?.id !== displayCoach.user_id && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
                        <div className="border-t border-surface-200 bg-surface/90 px-4 py-3 backdrop-blur">
                            <button
                                onClick={goToSubscribeTab}
                                className="h-12 w-full rounded-2xl bg-primary text-sm font-black tracking-tight text-surface shadow-lg transition active:scale-[0.99]"
                            >
                                {userSubscription?.status === 'active'
                                    ? '查看订阅'
                                    : userSubscription?.status === 'waiting'
                                        ? '查看订阅进度'
                                        : '立即订阅 / 查看价格'}
                            </button>
                            <p className="mt-2 text-center text-[11px] text-surface-500">
                                不用右滑到“订阅价格”，点这里直接跳转
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (loadingProfile) {
        return (
            <div className="min-h-screen">
                <div className="border-b border-surface-200 bg-surface shadow-sm">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="flex h-16 items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="h-5 w-5 rounded bg-surface-200" />
                                <div className="h-4 w-20 rounded bg-surface-200" />
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="h-5 w-5 rounded bg-surface-200" />
                                <div className="h-5 w-5 rounded bg-surface-200" />
                            </div>
                        </div>
                    </div>
                </div>
                {renderCoachSkeleton()}
            </div>
        );
    }

    return null;
};

export default CoachProfilePage;
