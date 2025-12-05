'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Tooltip } from 'primereact/tooltip';
import { Menu } from 'primereact/menu';
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useLoginModal } from '@/components/auth/LoginModalContext';
import { useOnboardingModal } from '@/components/auth/OnboardingModalContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { coachService } from '@/app/service/coachService';

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openLoginModal } = useLoginModal();
    const { openOnboardingModal } = useOnboardingModal();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);
    
    // View Mode State: 'coach' or 'student'
    const [viewMode, setViewMode] = useState<'coach' | 'student'>('student');

    // Initialize view mode based on primary role when session loads
    useEffect(() => {
        if (session?.user?.primary_role === 'coach') {
            setViewMode('coach');
        } else {
            setViewMode('student');
        }
    }, [session?.user?.primary_role]);

    // Client-side hydration check
    useEffect(() => {
        setIsClient(true);
    }, []);

    // 检查是否完成初始问卷 (Onboarding Check)
    useEffect(() => {
        if (status === 'loading') return;

        // 如果用户已登录
        if (session?.user) {
            const profile = session.profile as any;
            
            // 检查 onboarding_completed 状态
            // 注意：如果 profile 不存在，也视为未完成（需要创建档案）
            const isCompleted = profile?.onboarding_completed === true;

            if (!isCompleted) {
                // 打开问卷模态框而不是重定向
                openOnboardingModal();
            }
        }
    }, [session, status, openOnboardingModal]);

    const gotoCoachDisplayPage = async () => {
        const res = await coachService.getCoach({
            userId: session?.user?.id || ''
        });
        if (res) {
            router.push('/coach/profile/' + res.coach.id);
        }
    }

    // Toggle View Mode
    const toggleViewMode = useCallback(() => {
        setViewMode(prev => prev === 'coach' ? 'student' : 'coach');
        // Optional: Redirect to home or specific dashboard page when switching?
        // For now, let's keep user on current page or redirect to root if needed.
        if (viewMode === 'coach') {
             router.push('/'); // Switch to student -> go to home
        } else {
             router.push('/dashboard/overview'); // Switch to coach -> go to dashboard
        }
    }, [viewMode, router]);

    // ✅ Coach Navigation Items
    const coachMenuItems = useMemo(() => [
        { label: '概览', icon: 'pi pi-chart-line', command: () => router.push('/dashboard/overview') },
        { label: '视频点评', icon: 'pi pi-play-circle', command: () => router.push('/dashboard/videos') },
        { label: '我的学员', icon: 'pi pi-user', command: () => router.push('/dashboard/students') },
        { label: '内容管理', icon: 'pi pi-file-edit', command: () => router.push('/dashboard/content') },
        { label: '计划模板', icon: 'pi pi-clipboard', command: () => router.push('/dashboard/plan-lib') },
    ], [router]); 

    // ✅ Student Navigation Items
    const studentMenuItems = useMemo(() => [
        {
            label: '今日训练',
            icon: 'pi pi-play',
            command: () => router.push('/today-training'),
        },
        {
            label: '发现教练',
            icon: 'pi pi-search',
            command: () => router.push('/coach/discovery'),
        },
        {
            label: '训练计划',
            icon: 'pi pi-clipboard',
            command: () => router.push('/coach/plans'),
        },
        {
            label: '我的档案',
            icon: 'pi pi-id-card',
            command: () => router.push('/me/profile'),
        },
        {
            label: '排行榜',
            icon: 'pi pi-chart-line',
            command: () => router.push('/ranking'),
        },
    ], [router]);

    // ✅ User Menu Items (Avatar Dropdown)
    const userMenuItems = useMemo(() => {
        const items = [];

        // Mode Switcher for Coaches
        if (session?.user?.primary_role === 'coach') {
            items.push({
                label: viewMode === 'coach' ? '切换至学员端' : '切换至教练端',
                icon: viewMode === 'coach' ? 'pi pi-user' : 'pi pi-briefcase',
                command: toggleViewMode
            });
            items.push({ separator: true });
        }

        // Coach Specific Items (in User Menu)
        if (viewMode === 'coach') {
             items.push(
                { label: '我的主页', icon: 'pi pi-home', command: () => gotoCoachDisplayPage() },
                { label: '动作库', icon: 'pi pi-database', command: () => router.push('/dashboard/action-lib') },
                { label: '定价与服务', icon: 'pi pi-wallet', command: () => router.push('/dashboard/pricing') },
                { separator: true }
             );
        }

        // Common Items
        if (viewMode === 'student') {
             items.push(
                {
                    label: '我的订阅',
                    icon: 'pi pi-book',
                    command: () => router.push('/coach/subscription'),
                },
                { separator: true }
             );
             if (session?.user?.primary_role !== 'coach') {
                 items.push({
                    label: '申请成为教练',
                    icon: 'pi pi-user-plus',
                    command: () => router.push('/apply'),
                }, { separator: true });
             }
        }

        items.push(
            {
                label: '个人设置',
                icon: 'pi pi-cog',
                command: () => openProfileSetupModal(session?.profile, session?.user?.id),
            },
            {
                label: '退出登录',
                icon: 'pi pi-sign-out',
                command: () => signOut({ callbackUrl: '/' }),
            }
        );

        return items;
    }, [session, viewMode, toggleViewMode, openProfileSetupModal, router]);

    // ✅ Handle User Menu Toggle
    const handleUserMenuToggle = useCallback((event: React.MouseEvent) => {
        menuRef.current?.toggle(event);
    }, []);

    // ✅ Logo
    const start = (
        <Link href={viewMode === 'coach' ? "/dashboard/overview" : "/"} className="flex items-center space-x-3 mr-4">
            <img src="/favicon.jpg" alt="logo" className="h-10 rounded-md" />
            <span className="text-2xl font-extrabold">
                教<span className="text-primary">链</span>
                {viewMode === 'coach' && <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full align-middle">教练端</span>}
            </span>
        </Link>
    );

    // ✅ Right Side: Login/User/Theme
    const end = (
        <div className="flex items-center gap-3 h-full">
            {status === 'loading' ? (
                <div className="flex items-center gap-3">
                    <Skeleton shape="circle" size="2rem" />
                    <div className="flex flex-col gap-1">
                        <Skeleton width="6rem" height="1rem" />
                        <div className="flex gap-1">
                            <Skeleton width="3rem" height="0.8rem" borderRadius="9999px" />
                            <Skeleton width="3rem" height="0.8rem" borderRadius="9999px" />
                        </div>
                    </div>
                </div>
            ) : session?.user ? (
                <>
                    {/* Message Button */}
                    <Tooltip target=".message-button" position="bottom" />
                    <div className="relative">
                        <Button
                            icon="pi pi-comment"
                            onClick={() => router.push('/messages')}
                            rounded
                            text
                            className="message-button shrink-0"
                            data-pr-tooltip="消息"
                        />
                        <MessageBadge className="absolute -top-1 -right-1" />
                    </div>

                    {/* User Avatar & Info */}
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded-lg transition-colors"
                        onClick={handleUserMenuToggle}
                        aria-label="用户菜单"
                    >
                        <Avatar
                            image={session.profile?.avatar_url || undefined}
                            label={
                                session.profile?.avatar_url
                                    ? undefined
                                    : session.profile?.nickname?.charAt(0) ||
                                    session.user.phone?.slice(0, 1) ||
                                    'U'
                            }
                            shape="circle"
                            className="bg-primary text-white font-bold flex-shrink-0"
                            size="normal"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">
                                {session.profile?.nickname || session.user.phone}
                            </span>
                            <div className="flex gap-1">
                                {session.user.subscription_level && (
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded-full ${session.user.subscription_level === 'basic'
                                            ? 'bg-gray-100 text-gray-600'
                                            : session.user.subscription_level === 'advanced'
                                                ? 'bg-blue-100 text-blue-600'
                                                : session.user.subscription_level === 'premium'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : ''
                                            }`}
                                    >
                                        {session.user.subscription_level === 'basic'
                                            ? '基础会员'
                                            : session.user.subscription_level === 'advanced'
                                                ? '高级会员'
                                                : session.user.subscription_level === 'premium'
                                                    ? '至尊会员'
                                                    : ''}
                                    </span>
                                )}
                                {session.user.primary_role && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                                        {viewMode === 'student'
                                            ? '学员'
                                            : '教练'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <Button
                    label="登录"
                    icon="pi pi-sign-in"
                    size="small"
                    onClick={openLoginModal}
                    className="p-button-outlined"
                />
            )}

            {/* Theme Toggle */}
            <Tooltip target=".theme-toggle" position="bottom" />
            <Button
                icon={theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'}
                onClick={toggleTheme}
                rounded
                text
                className="theme-toggle shrink-0"
                data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            />
        </div>
    );

    return (
        <>
            <Menubar
                model={viewMode === 'coach' ? coachMenuItems : studentMenuItems}
                start={start}
                end={end}
                className="sticky top-0 z-50 border-b shadow-sm px-4"
            />

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                id="user_menu"
                className="min-w-40"
            />
        </>
    );
}
