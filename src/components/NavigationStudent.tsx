'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useOnboardingModal } from '@/components/auth/OnboardingModalContext';
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { 
    PlayCircle, 
    Search, 
    ClipboardList, 
    TrendingUp, 
    Bell, 
    Moon, 
    Sun, 
    ChevronDown,
    LogIn,
    User,
    Activity,
    Users
} from 'lucide-react';

export default function NavigationStudent() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { openOnboardingModal, clearOnboardingSuppression } = useOnboardingModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        if (session?.user) {
            const profile = session.profile as any;
            if (profile?.onboarding_completed === true) {
                // Once session reflects completion, allow future onboarding opens (if needed)
                clearOnboardingSuppression();
                return;
            }

            if (profile?.onboarding_completed !== true) {
                openOnboardingModal();
            }
        }
    }, [session, status, openOnboardingModal, clearOnboardingSuppression]);

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
        { label: '训练计划', icon: ClipboardList, url: '/coach/plans', command: () => router.push('/coach/plans'), template: itemRenderer },
        { label: '排行榜', icon: TrendingUp, url: '/ranking', command: () => router.push('/ranking'), template: itemRenderer },
        { label: '个人档案', icon: User, url: '/me/profile', command: () => router.push('/me/profile'), guideId: 'guide-profile', template: itemRenderer },
    ], [router, pathname]);

    const userMenuItems = useMemo(() => [
        { label: '我的订阅', icon: 'pi pi-star', command: () => router.push('/coach/subscription') },
        { label: '我的会员', icon: 'pi pi-crown', command: () => router.push('/me/membership') },
        { separator: true },
        { label: '我的好友', icon: 'pi pi-users', command: () => router.push('/friends') },
        { label: '我的动作库', icon: 'pi pi-list', command: () => router.push('/me/action-lib') },
        { label: '知识库', icon: 'pi pi-book', command: () => router.push('/dashboard/knowledge') },
        { label: '常用计划', icon: 'pi pi-bookmark', command: () => router.push('/me/plan-lib') },
        { label: '训练历史', icon: 'pi pi-history', command: () => router.push('/me/plan-history') },
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
                        if (res.ok) window.location.href = '/dashboard';
                    } catch (e) { console.error(e); }
                } else { router.push('/coach/application'); }
            },
        },
        { separator: true },
        { label: '个人设置', icon: 'pi pi-cog', command: () => openProfileSetupModal(session?.profile, session?.user?.id) },
        { label: '账户设置', icon: 'pi pi-shield', command: () => router.push('/me/settings') },
        { label: '退出登录', icon: 'pi pi-sign-out', className: 'text-rose-500', command: () => signOut({ callbackUrl: '/' }) }
    ], [session, openProfileSetupModal, router]);

    const start = (
        <Link href="/" className="flex items-center gap-3 mr-8 group transition-transform active:scale-95">
            <div className="relative">
                {/* 保持原比例的图标展示 */}
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
                            className={`
                                p-2 rounded-xl transition-all pi 
                                ${theme === 'light'
                                                        ? 'pi-moon text-surface-500 hover:text-indigo-600' // 亮色时显月亮，悬浮变靛蓝
                                                        : 'pi-sun text-yellow-500 hover:text-yellow-400'  // 暗色时显太阳，悬浮变浅黄
                                                    } 
                                hover:bg-surface
                            `}
                        />
                    </div>

                    <div
                        className="flex items-center gap-2 pl-1 pr-3 py-1 bg-surface border border-surface-100 rounded-2xl cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all active:scale-[0.97]"
                        onClick={(e) => menuRef.current?.toggle(e)}
                    >
                        <Avatar
                            image={session.profile?.avatar_url || undefined}
                            label={session.profile?.avatar_url ? undefined : (session.profile?.nickname?.charAt(0) || 'U')}
                            shape="circle"
                            className="bg-primary-500 text-surface text-xs font-bold"
                        />
                        <div className="hidden md:flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold text-surface-900 truncate max-w-[100px]">
                                {session.profile?.nickname || '学员'}
                            </span>
                            <span className="text-[10px] text-surface-400 font-medium">Ready</span>
                        </div>
                        <ChevronDown size={14} className="ml-1 text-surface-300" />
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
            <div className="sticky top-0 z-50 w-full px-4 pt-3 pointer-events-none">
                <Menubar
                    model={studentMenuItems}
                    start={start}
                    end={end}
                    className="max-w-7xl mx-auto pointer-events-auto backdrop-blur-md bg-surface/80 border border-surface/20 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl px-6 py-2"
                />
            </div>

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                className="mt-2 border-none shadow-xl rounded-2xl p-2 min-w-48 text-sm"
            />
        </>
    );
}