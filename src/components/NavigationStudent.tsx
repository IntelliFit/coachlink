'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import { Sidebar } from 'primereact/sidebar'; // 引入 Sidebar
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useOnboardingModal } from '@/components/auth/OnboardingModalContext';
import { useSession, signOut, getSession } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { subscriptionService } from '@/app/service/subscriptionService';
import { userService } from '@/app/service/userService';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import type { UserProfilesRow } from '@/types';
import {
    PlayCircle,
    Search,
    ClipboardList,
    TrendingUp,
    Bell,
    Moon,
    Sun,
    ArrowLeft,
    ChevronDown,
    Bookmark,
    LogIn,
    User,
    Activity,
    Users,
    Menu as MenuIcon, // 引入菜单图标
    Headphones,
    MessageSquare
} from 'lucide-react';

export default function NavigationStudent() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { openOnboardingModal, clearOnboardingSuppression, isOnboardingModalOpen } = useOnboardingModal();
    const { data: session, status, update: updateSession } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);
    const [lastSubscriptionCheck, setLastSubscriptionCheck] = useState<number>(0);
    const [visibleLeft, setVisibleLeft] = useState(false); // 控制侧边菜单显示
    const [profile, setProfile] = useState<UserProfilesRow | null>(null);
    // 使用 useRef 记录已检查过的 profile 状态，避免重复检查（不会触发重新渲染）
    const checkedProfileStateRef = useRef<{
        profileId?: string;
        onboardingCompleted?: boolean;
    } | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // PWA 恢复时主动刷新 session（解决 Android Chrome 息屏后 session 丢失问题）
                getSession().catch(() => {
                    // 静默失败，避免控制台噪音
                });
            }
        };
        window.addEventListener('visibilitychange', handleVisibilityChange);
        // 页面加载时也尝试恢复 session（PWA 从后台恢复时）
        if (document.visibilityState === 'visible') {
            getSession().catch(() => {});
        }
        return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // 获取用户档案
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            setProfile(null);
            checkedProfileStateRef.current = null; // 重置检查标记
            return;
        }
        const loadProfile = async () => {
            try {
                const res = await userService.getProfile({});
                if (res?.profile) {
                    setProfile(res.profile);
                }
            } catch (error) {
                console.error('获取用户档案失败:', error);
            }
        };
        loadProfile();
    }, [status, session?.user?.id]);

    // 检查 onboarding 完成状态（优化后的逻辑）
    useEffect(() => {
        // 等待认证状态加载完成
        if (status === 'loading') return;
        
        // 确保有用户和 profile 数据
        if (!session?.user || !profile) return;
        
        // 如果弹窗已经打开，不要重复触发
        if (isOnboardingModalOpen) return;
        
        // 检查是否已经检查过相同的 profile 状态
        // 只有当 profile.id 或 onboarding_completed 发生变化时才重新检查
        const currentState = {
            profileId: profile.id,
            onboardingCompleted: profile.onboarding_completed
        };
        
        const previousState = checkedProfileStateRef.current;
        if (previousState && 
            previousState.profileId === currentState.profileId &&
            previousState.onboardingCompleted === currentState.onboardingCompleted) {
            // 已经检查过相同的状态，不需要重复检查
            return;
        }
        
        // 标记为已检查当前状态
        checkedProfileStateRef.current = currentState;
        
        // 严格判断：只有明确为 true 时才认为已完成
        if (profile.onboarding_completed === true) {
            clearOnboardingSuppression();
            return;
        }
        
        // 只有在 onboarding_completed 明确不是 true 时才打开弹窗
        // 注意：这里不判断 null/undefined，因为可能是新用户还没有 profile
        if (profile.onboarding_completed === false || profile.onboarding_completed === null || profile.onboarding_completed === undefined) {
            openOnboardingModal();
        }
    }, [session?.user?.id, profile?.id, profile?.onboarding_completed, status, isOnboardingModalOpen, clearOnboardingSuppression, openOnboardingModal]);

    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) return;
        const checkSubscriptions = () => {
            const now = Date.now();
            if (now - lastSubscriptionCheck < 10 * 60 * 1000) return;
            setLastSubscriptionCheck(now);
            // Fire and forget: 不等待结果，避免阻塞 UI
            subscriptionService.checkExpiredSubscriptions().catch((error) => {
                console.error('Error checking expired subscriptions:', error);
            });
        };
        checkSubscriptions();
        const interval = setInterval(checkSubscriptions, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [status, session?.user?.id, lastSubscriptionCheck]);

    const itemRenderer = (item: any) => {
        const isActive = pathname === item.url;
        return (
            <div
                id={item.guideId}
                onClick={item.command}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-all duration-300 group
                    ${isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-surface-600 hover:text-primary-600'}
                `}
            >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </div>
        );
    };

    const studentMenuItems = useMemo(() => [
        { label: '今日训练', icon: PlayCircle, url: '/today-training', command: () => router.push('/today-training'), guideId: 'guide-today-training', template: itemRenderer },
        { label: '好友动态', icon: Activity, url: '/friends/activity', command: () => router.push('/friends/activity'), template: itemRenderer },
        { label: '发现教练', icon: Search, url: '/coach/discovery', command: () => router.push('/coach/discovery'), guideId: 'guide-find-coach', template: itemRenderer },
        { label: '排行榜', icon: TrendingUp, url: '/ranking', command: () => router.push('/ranking'), template: itemRenderer },
        { label: '个人档案', icon: User, url: '/me/profile', command: () => router.push('/me/profile'), guideId: 'guide-profile', template: itemRenderer },
    ], [router, pathname]);

    const userMenuItems = useMemo(() => [
        // 统一入口：当前计划（替代"训练计划"）
        { label: '当前计划', icon: 'pi pi-clipboard', command: () => { router.push('/coach/plans'); setVisibleLeft(false); } },
        { label: '我的教练', icon: 'pi pi-star', command: () => { router.push('/coach/subscription'); setVisibleLeft(false); } },
        { label: '我的会员', icon: 'pi pi-crown', command: () => { router.push('/me/membership'); setVisibleLeft(false); } },
        ...(STUDENT_TOOLBOX_LINKS.length
            ? [
                {
                    label: '工具箱',
                    icon: 'pi pi-briefcase',
                    command: () => { router.push('/me/toolbox'); setVisibleLeft(false); },
                },
            ]
            : []),
        { separator: true },
        { label: '我的好友', icon: 'pi pi-users', command: () => { router.push('/friends'); setVisibleLeft(false); } },
        { label: '我的动作库', icon: 'pi pi-list', command: () => { router.push('/me/action-lib'); setVisibleLeft(false); } },
        { label: '知识库', icon: 'pi pi-book', command: () => { router.push('/dashboard/knowledge'); setVisibleLeft(false); } },
        { label: '我的计划库', icon: 'pi pi-bookmark', command: () => { router.push('/me/plan-lib'); setVisibleLeft(false); } },
        { label: '训练历史', icon: 'pi pi-history', command: () => { router.push('/me/plan-history'); setVisibleLeft(false); } },
        { separator: true },
        {
            label: (session?.user as any)?.is_coach ? '切换到教练端' : '申请成为教练',
            icon: (session?.user as any)?.is_coach ? 'pi pi-sync' : 'pi pi-sparkles',
            command: async () => {
                if ((session?.user as any)?.is_coach) {
                    try {
                        const res = await fetch('/api/user/switch-role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ role: 'coach' })
                        });
                        if (res.ok) {
                            // 刷新 session，确保 JWT 中 primary_role 立即更新
                            try {
                                await updateSession();
                            } catch (e) {
                                console.warn('刷新 session 失败:', e);
                            }
                            window.location.href = '/dashboard';
                        }
                    } catch (e) { console.error(e); }
                } else { router.push('/coach/application'); }
                setVisibleLeft(false);
            },
        },
        { separator: true },
        { label: '个人设置', icon: 'pi pi-cog', command: () => { openProfileSetupModal(profile, session?.user?.id); setVisibleLeft(false); } },
        { label: '账户设置', icon: 'pi pi-shield', command: () => { router.push('/me/settings'); setVisibleLeft(false); } },
        { label: '退出登录', icon: 'pi pi-sign-out', className: 'text-rose-500', command: () => signOut({ callbackUrl: '/' }) }
    ], [session, profile, openProfileSetupModal, router, updateSession]);

    const studentTabRoots = useMemo(() => [
        '/today-training', '/coach/discovery', '/me/profile', '/ranking', '/friends/activity',
    ], []);

    // 1. 移动端顶部的纯文字 Tab 布局
    const mobileTopTabs = useMemo(() => [
        { label: '动态', url: '/friends/activity' },
        { label: '训练', url: '/today-training' },
        { label: '排行', url: '/ranking' },
    ], []);

    // 2. 移动端底部导航：将"发现"、"档案"与"消息"、"菜单(头像)"整合
    const mobileBottomTabs = useMemo(() => [
        {
            key: 'discover',
            label: '发现教练',
            icon: Search,
            active: pathname.startsWith('/coach/discovery'),
            onClick: () => router.push('/coach/discovery'),
        },
        {
            key: 'plan',
            label: '计划库',
            icon: Bookmark,
            active: pathname.startsWith('/me/plan-lib'),
            onClick: () => router.push('/me/plan-lib'),
        },
        {
            key: 'messages',
            label: '消息',
            icon: Bell, // 内部会处理 Badge
            active: pathname === '/messages',
            onClick: () => router.push('/messages'),
            isMessage: true
        },
        {
            key: 'profile',
            label: '我',
            icon: User,
            active: pathname.startsWith('/me/profile'),
            onClick: () => router.push('/me/profile'),
        },
    ], [pathname, router, visibleLeft]);

    const start = (
        <Link href="/" className="flex items-center gap-3 mr-8 group transition-transform active:scale-95">
            <div className="relative">
                <img src="/favicon.jpg" alt="logo" className="h-9 w-auto rounded-xl shadow-sm group-hover:shadow-primary-100 transition-all object-contain" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-surface rounded-full"></div>
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tighter text-surface-900">
                    教<span className="text-primary-500">链</span>
                </span>
                <span className="text-[10px] font-bold text-primary-500/80 uppercase mt-0.5">Student</span>
            </div>
        </Link>
    );

    const end = (
        <div className="flex items-center gap-1">
            {status === 'loading' ? (
                <Skeleton shape="circle" size="2.5rem" className="bg-surface-100" />
            ) : session?.user ? (
                <>
                    <div className="flex items-center gap-0.5 bg-surface-50 p-1 rounded-2xl mr-2">
                        <button onClick={() => router.push('/messages')} className="relative p-2 rounded-xl text-surface-500 hover:bg-surface hover:text-primary-500 transition-all pi pi-bell p-overlay-badge">
                            <MessageBadge className="absolute top-1.5 right-1.5 border-2 border-surface-50" />
                        </button>
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-xl transition-all pi ${theme === 'light' ? 'pi-moon text-surface-500 hover:text-indigo-600' : 'pi-sun text-yellow-500 hover:text-yellow-400'} hover:bg-surface`}
                        />
                    </div>

                    <div
                        className="flex items-center gap-2 pl-1 pr-3 py-1 bg-surface border border-surface-100 rounded-2xl cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all active:scale-[0.97]"
                        onClick={(e) => {
                            // 桌面端使用弹窗，移动端不做处理（通过左侧按钮打开）
                            if (window.innerWidth >= 768) {
                                menuRef.current?.toggle(e);
                            }
                        }}
                    >
                        <Avatar
                            image={profile?.avatar_url || undefined}
                            label={profile?.avatar_url ? undefined : (profile?.nickname?.charAt(0) || 'U')}
                            shape="circle"
                            className="bg-primary-500 text-surface text-xs font-bold inner-img-object-fit"
                        />
                        <div className="hidden md:flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold text-surface-900 truncate max-w-[100px]">
                                {profile?.nickname || '学员'}
                            </span>
                            <span className="text-[10px] text-surface-400 font-medium">Ready</span>
                        </div>
                        <ChevronDown size={14} className="ml-1 text-surface-300 hidden md:block" />
                    </div>
                </>
            ) : (
                <button
                    onClick={() => router.push('/login')}
                    className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-primary-500 text-surface font-bold text-sm shadow-md shadow-primary-200 dark:shadow-primary-700 hover:bg-primary-600 transition-all active:scale-95"
                >
                    <LogIn size={18} />
                    <span>登录</span>
                </button>
            )}
        </div>
    );

    return (
        <>
            {/* Mobile: 侧边栏菜单（小红书风格） */}
            <Sidebar
                visible={visibleLeft}
                onHide={() => setVisibleLeft(false)}
                // 修改点：使用 w-[80vw] 确保右侧留出点击关闭的遮罩空间
                className="w-[80vw] md:hidden p-0 overflow-y-auto border-none"
                showCloseIcon={false}
                pt={{
                    content: {
                        className: 'p-0'
                    },
                    header: {
                        className: 'bg-surface'
                    },
                }}
                blockScroll
            >
                <div className="flex flex-col h-full bg-surface">
                    {/* 侧边栏头部：用户信息 */}
                    <div className="p-6 pt-10 border-b border-surface-50">
                        <div className="flex flex-col gap-4">
                            <Avatar
                                image={profile?.avatar_url || undefined}
                                label={profile?.avatar_url ? undefined : (profile?.nickname?.charAt(0) || 'U')}
                                shape="circle"
                                size="xlarge"
                                className="bg-primary-500 text-surface font-bold shadow-lg"
                            />
                            <div>
                                <h3 className="text-xl font-black text-surface-900 leading-none mb-1">
                                    {profile?.nickname || '学员'}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-full uppercase">
                                        Student
                                    </span>
                                    <span className="text-[10px] text-surface-400 font-medium">
                                        ID: {session?.user?.id?.slice(-6).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 侧边栏菜单项：容器增加滚动支持 */}
                    <div className="flex-1 overflow-y-auto py-4 px-3">
                        {userMenuItems.map((item, index) => {
                            if (item.separator) return <div key={index} className="h-px bg-surface-100/50 my-2 mx-3" />;

                            const isLogout = item.label === '退出登录';

                            return (
                                <button
                                    key={index}
                                    onClick={() => item.command?.()}
                                    className={`
                                        w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all 
                                        active:scale-[0.96] active:bg-surface-100
                                        ${isLogout ? 'text-rose-500 mt-4' : 'text-surface-700'}
                                    `}
                                >
                                    <div className={`
                                        flex items-center justify-center w-8 h-8 rounded-xl
                                        ${isLogout ? 'bg-rose-50' : 'bg-surface-50'}
                                    `}>
                                        {typeof item.icon === 'string' && (
                                            <i className={`${item.icon} ${isLogout ? 'text-rose-500' : 'text-surface-500'} text-base`} />
                                        )}
                                    </div>
                                    <span className={`text-sm ${isLogout ? 'font-bold' : 'font-semibold'}`}>
                                        {item.label as React.ReactNode}
                                    </span>
                                    {!isLogout && <i className="pi pi-chevron-right ml-auto text-[10px] text-surface-300" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* 侧边栏底部：功能切换 & 客服 */}
                    <div className="p-6 border-t border-surface-50 bg-surface flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {/* 主题切换按钮 */}
                            <button
                                onClick={toggleTheme}
                                title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
                                className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface shadow-sm border border-surface-200/50 text-surface-600 active:scale-90 transition-transform"
                            >
                                {theme === 'light' ? (
                                    <Moon size={18} className="text-indigo-600" />
                                ) : (
                                    <Sun size={18} className="text-yellow-500" />
                                )}
                            </button>

                            {/* 客服按钮 */}
                            <button
                                onClick={() => {
                                    // 这里填写你的客服逻辑，比如跳转路由或打开第三方聊天
                                    router.push('/feedback');
                                    setVisibleLeft(false);
                                }}
                                className="flex items-center gap-2 px-3 h-10 rounded-xl bg-surface shadow-sm border border-surface-200/50 text-surface-600 active:scale-90 transition-transform"
                            >
                                <MessageSquare size={18} />
                                <span className="text-xs font-bold">反馈</span>
                            </button>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-surface-300 font-black tracking-widest italic leading-none">V0.0.1</span>
                        </div>
                    </div>
                </div>
            </Sidebar>

            {/* Mobile: 顶部导航 (类似小红书：左侧菜单 + 居中 Tab) */}
            {session && (
                <div className="md:hidden sticky top-0 z-50 w-full pt-[env(safe-area-inset-top)] bg-surface/80 backdrop-blur-md border-b border-surface-100">
                    <div className="flex items-center h-14 px-4">
                        {/* 左侧：找回菜单触发按钮 */}
                        <div className="flex-1">
                            <button
                                onClick={() => setVisibleLeft(true)}
                                className="p-2 -ml-2 text-surface-600 active:scale-90 transition-transform"
                            >
                                <MenuIcon size={24} strokeWidth={2} />
                            </button>
                        </div>

                        {/* 中间：文字 Tab */}
                        <div className="flex-[3] flex justify-center gap-6">
                            {mobileTopTabs.map((tab) => {
                                const isActive = pathname === tab.url;
                                return (
                                    <button
                                        key={tab.url}
                                        onClick={() => router.push(tab.url)}
                                        className="relative flex flex-col items-center justify-center h-14"
                                    >
                                        <span className={`text-[15px] transition-all ${isActive
                                            ? 'text-surface-900 font-bold scale-110'
                                            : 'text-surface-500 font-medium'
                                            }`}>
                                            {tab.label}
                                        </span>
                                        {isActive && (
                                            <div className="absolute bottom-2 w-4 h-0.5 bg-primary-500 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 右侧：为了保持视觉对称留出的占位 (也可以放搜索) */}
                        <div className="flex-1 flex justify-end">
                            <button className="p-2 -mr-2 text-surface-400 opacity-0 pointer-events-none">
                                <Search size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop: Menubar 保持不变 */}
            <div className="hidden md:block sticky top-0 z-50 w-full px-4 pt-3 pointer-events-none">
                <Menubar
                    model={studentMenuItems}
                    start={start}
                    end={end}
                    className="max-w-7xl mx-auto pointer-events-auto backdrop-blur-md bg-surface/80 border border-surface/20 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl px-6 py-2"
                />
            </div>

            {/* Mobile: 底部主导航 (精简为 3 个核心入口) */}
            {session && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 bg-gradient-to-t from-surface via-surface to-transparent">
                    <div className="backdrop-blur-xl bg-surface/90 border border-surface-200/50 shadow-2xl rounded-full px-4 py-2">
                        <div className="flex justify-around items-center">
                            {mobileBottomTabs.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={item.onClick}
                                    className={`relative flex flex-col items-center justify-center w-16 py-1 transition-all active:scale-90 ${item.active ? 'text-primary-600' : 'text-surface-500'
                                        }`}
                                >
                                    <div className="relative">
                                        <item.icon size={24} strokeWidth={item.active ? 2.5 : 2} />
                                        {item.isMessage && (
                                            <MessageBadge className="absolute -top-2.5 -right-2.5 border-2 border-surface" />
                                        )}
                                    </div>
                                    <span className={`text-[10px] mt-1 ${item.active ? 'font-bold' : 'font-medium'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                className="mt-2 border-none shadow-xl rounded-2xl p-2 min-w-48 text-sm"
            />
        </>
    );
}
