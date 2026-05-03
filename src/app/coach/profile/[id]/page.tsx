'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';
import CoachIntroduction from './CoachIntroduction';
import CoachContent from './CoachContent';
import { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';

const CoachProfilePage: React.FC = () => {
    const searchParam = useSearchParams();
    const [activeTab, setActiveTab] = useState<number>(parseInt(searchParam.get('tab') || '0'));

    const [mySubscriptions, setMySubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [userSubscription, setUserSubscription] = useState<QueryCoachSubscription | null>(null);
    const [coach, setCoach] = useState<CoachesRow | null>(null);

    const [aggregatedInfo, setAggregatedInfo] = useState<GetAggregatedInfoResponseDto | null>(null);
    const [isLoadingCoach, setIsLoadingCoach] = useState(true);

    const router = useRouter();
    const params = useParams();
    const coachId = params.id;
    if (!coachId) {
        router.push('/coach');
    }

    // 获取当前URL的搜索参数
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    const { showToast } = useToastContext();
    const { data: session } = useSession();

    const SUBSCRIBE_TAB_INDEX = 1; // 订阅价格现在在第二栏（index 1）

    const goToSubscribeTab = useCallback(() => {
        setActiveTab(SUBSCRIBE_TAB_INDEX);

        // 同步 URL，便于分享/刷新后保持在订阅价格。
        // IMPORTANT: 使用 history.replaceState 避免线上某些机型/环境下 router.replace 触发滚动恢复导致“滑下去又被拉回顶部”。
        if (typeof window !== 'undefined') {
            const nextParams = new URLSearchParams(window.location.search);
            nextParams.set('tab', String(SUBSCRIBE_TAB_INDEX));
            const nextUrl = `${window.location.pathname}?${nextParams.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', nextUrl);
        }

        const isInView = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            // 已经在视窗上方 40% 以内，视作“已到达”，避免再次点击把用户拉回更上方
            return rect.top >= 0 && rect.top <= window.innerHeight * 0.4;
        };

        // 优先滚动到价格锚点（订阅 Tab 顶部）。如果已经在订阅价格附近，则不做任何滚动。
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

        // 等待 TabView 切换后渲染订阅价格面板（PrimeReact 可能懒渲染）
        setTimeout(loop, 0);
    }, [activeTab, coachId]);

    // 初始化教练信息
    const initCoach = async () => {
        try {
            setIsLoadingCoach(true);
            const res = await coachService.getCoach({ id: coachId?.toString() || '' });
            if (res && res.coach) {
                setCoach(res.coach);
            } else {
                showToast({ severity: 'error', summary: '获取教练信息失败' });
            }
        } catch (error) {
            console.error('获取教练信息失败:', error);
            showToast({ severity: 'error', summary: '获取教练信息失败' });
        } finally {
            setIsLoadingCoach(false);
        }
    };

    // 获取教练聚合信息
    const initAggregatedInfo = async () => {
        try {
            const res = await coachService.getAggregatedInfo({ coachId: coachId?.toString() || '' });
            if (res) {
                setAggregatedInfo(res);
            }
        } catch (error) {
            console.error('获取教练聚合信息失败:', error);
        }
    };

    const initSubscriptions = async () => {
        if (!session?.user?.id) return;
        const res = await subscriptionService.getCoachSubscriptions({
            studentId: session?.user.id || '',
            onlyActive: false
        });
        
        if (res) {
            setMySubscriptions(res.subscriptions || []);
            setUserSubscription(res.subscriptions.find(sub => sub.coach_id === coachId) || null);
        }
    }
    // 检查URL参数以设置初始活动标签
    useEffect(() => {
        const tabId = parseInt(searchParams.get('tab') || '0');
        setActiveTab(tabId);
        initCoach();
        initAggregatedInfo();
    }, []);

    useEffect(() => {
        if (!session?.user?.id) {
            setMySubscriptions([]);
            setUserSubscription(null);
            return;
        }
        initSubscriptions();
    }, [session?.user?.id]);


    // 添加骨架屏组件
    const renderCoachSkeleton = () => (
        <div className="bg-surface animate-pulse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 头像区域骨架 */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 bg-surface-200 rounded-full mb-4"></div>
                        <div className="w-20 h-20 bg-surface-200 rounded-lg"></div>
                    </div>

                    {/* 详细信息区域骨架 */}
                    <div className="flex-1">
                        <div className="h-8 bg-surface-200 rounded w-1/3 mb-4"></div>
                        <div className="h-6 bg-surface-200 rounded w-1/4 mb-6"></div>

                        {/* 统计信息骨架 */}
                        <div className="flex space-x-4 mb-6">
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                        </div>

                        {/* 专业领域骨架 */}
                        <div className="space-y-3 mb-6">
                            <div className="h-4 bg-surface-200 rounded w-1/4"></div>
                            <div className="flex space-x-2">
                                <div className="h-6 bg-surface-200 rounded-full w-16"></div>
                                <div className="h-6 bg-surface-200 rounded-full w-20"></div>
                                <div className="h-6 bg-surface-200 rounded-full w-16"></div>
                            </div>
                        </div>

                        {/* 简介骨架 */}
                        <div className="space-y-3">
                            <div className="h-4 bg-surface-200 rounded w-1/4"></div>
                            <div className="h-4 bg-surface-200 rounded w-full"></div>
                            <div className="h-4 bg-surface-200 rounded w-5/6"></div>
                            <div className="h-4 bg-surface-200 rounded w-4/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 在教练信息加载完成前显示骨架屏
    if (coach && aggregatedInfo) {
        const displayCoach = aggregatedInfo.coach || coach;
        const handleSubscribeSuccess = (tier?: number) => {
            // 如果传入了tier，说明是订阅操作，需要刷新订阅列表
            if (tier !== undefined) {
                initSubscriptions();
            }
            // 如果没有传入tier，说明是内容订阅，只需刷新当前组件
        };

        return (
            <div className="min-h-screen pb-24 md:pb-0">
                {/* 教练介绍部分 */}
                <CoachIntroduction
                    coach={displayCoach}
                    userSubscription={userSubscription}
                    aggregatedInfo={aggregatedInfo}
                    onGoToSubscribe={goToSubscribeTab}
                />

                {/* 教练内容部分（包含标签页） */}
                <CoachContent
                    coach={displayCoach}
                    coachId={displayCoach.id}
                    userSubscription={userSubscription}
                    mySubscriptions={mySubscriptions}
                    aggregatedInfo={aggregatedInfo}
                    onSubscribeSuccess={(tier) => handleSubscribeSuccess(tier)}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                {/* 移动端底部固定 CTA：避免“订阅价格 Tab 需要右滑才能看到” */}
                {session?.user?.id !== displayCoach.user_id && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
                        <div className="bg-surface/90 backdrop-blur border-t border-surface-200 px-4 py-3">
                            <button
                                onClick={goToSubscribeTab}
                                className="w-full h-12 rounded-2xl bg-primary text-surface font-black tracking-tight shadow-lg active:scale-[0.99] transition"
                            >
                                {userSubscription?.status === 'active'
                                    ? '查看订阅'
                                    : userSubscription?.status === 'waiting'
                                        ? '查看订阅进度'
                                        : '立即订阅 / 查看价格'}
                            </button>
                            <p className="mt-2 text-[11px] text-surface-500 text-center">
                                不用右滑找“订阅价格”，点这里直接跳转
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );

    } else {
        return (
            <div className="min-h-screen">
                {/* 顶部导航骨架 */}
                <div className="bg-surface shadow-sm border-b border-surface-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center space-x-2">
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                                <div className="h-4 w-20 bg-surface-200 rounded"></div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {renderCoachSkeleton()}
            </div>
        );
    }
};

export default CoachProfilePage;