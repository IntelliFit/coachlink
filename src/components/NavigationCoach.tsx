'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import { Sidebar } from 'primereact/sidebar';
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { coachService } from '@/app/service/coachService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { userService } from '@/app/service/userService';
import type { UserProfilesRow } from '@/types';
import {
    LayoutDashboard,
    PlayCircle,
    Users,
    FileEdit,
    ClipboardList,
    ArrowLeft,
    ChevronDown,
    LogIn,
    Menu as MenuIcon,
    Headphones,
    Moon,
    Sun,
    Bell,
    Search,
    User
} from 'lucide-react';

export default function NavigationCoach() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);
    const [visibleLeft, setVisibleLeft] = useState(false);
    const [lastSubscriptionCheck, setLastSubscriptionCheck] = useState<number>(0);
    const [profile, setProfile] = useState<UserProfilesRow | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // 获取用户档案
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            setProfile(null);
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

    const gotoCoachDisplayPage = async () => {
        const res = await coachService.getCoach({ userId: session?.user?.id || '' });
        if (res && res.coach) {
            router.push('/coach/profile/' + res.coach.id);
        }
    };

    // 移动端顶部 Tab 定义
    const mobileTopTabs = useMemo(() => [
        { label: '概览', url: '/dashboard/overview' },
        { label: '点评', url: '/dashboard/videos' },
        { label: '学员', url: '/dashboard/students' },
    ], []);

    // 移动端底部 Tab 定义
    const mobileBottomTabs = useMemo(() => [
        {
            key: 'content',
            label: '内容',
            icon: FileEdit,
            active: pathname.startsWith('/dashboard/content'),
            onClick: () => router.push('/dashboard/content'),
        },
        {
            key: 'planlib',
            label: '模板',
            icon: ClipboardList,
            active: pathname.startsWith('/dashboard/plan-lib'),
            onClick: () => router.push('/dashboard/plan-lib'),
        },
        {
            key: 'messages',
            label: '消息',
            icon: Bell,
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

    const itemRenderer = (item: any) => {
        const isActive = pathname === item.url;
        return (
            <div onClick={item.command} className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-all ${isActive ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600'}`}>
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </div>
        );
    };

    const coachMenuItems = useMemo(() => [
        { label: '概览', icon: LayoutDashboard, url: '/dashboard/overview', command: () => router.push('/dashboard/overview'), template: itemRenderer },
        { label: '视频点评', icon: PlayCircle, url: '/dashboard/videos', command: () => router.push('/dashboard/videos'), template: itemRenderer },
        { label: '我的学员', icon: Users, url: '/dashboard/students', command: () => router.push('/dashboard/students'), template: itemRenderer },
        { label: '内容管理', icon: FileEdit, url: '/dashboard/content', command: () => router.push('/dashboard/content'), template: itemRenderer },
        { label: '计划模板', icon: ClipboardList, url: '/dashboard/plan-lib', command: () => router.push('/dashboard/plan-lib'), template: itemRenderer },
    ], [router, pathname]);

    const userMenuItems = useMemo(() => [
        { label: '我的主页', icon: 'pi pi-home', command: () => { gotoCoachDisplayPage(); setVisibleLeft(false); } },
        { label: '我的钱包', icon: 'pi pi-wallet', command: () => { router.push('/dashboard/wallet'); setVisibleLeft(false); } },
        { label: '动作库', icon: 'pi pi-database', command: () => { router.push('/dashboard/action-lib'); setVisibleLeft(false); } },
        { label: '订阅设置', icon: 'pi pi-tags', command: () => { router.push('/dashboard/pricing'); setVisibleLeft(false); } },
        { label: '学员问卷', icon: 'pi pi-file', command: () => { router.push('/dashboard/questionnaire'); setVisibleLeft(false); } },
        { label: '收款码设置', icon: 'pi pi-qrcode', command: () => { router.push('/coach/settings/payment'); setVisibleLeft(false); } },
        { separator: true },
        {
            label: '切换至学员端', icon: 'pi pi-user', command: async () => {
                try {
                    const res = await fetch('/api/user/switch-role', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: 'student' })
                    });
                    if (res.ok) window.location.href = '/';
                } catch (e) { console.error(e); }
            }
        },
        { separator: true },
        { label: '个人设置', icon: 'pi pi-cog', command: () => { openProfileSetupModal(profile, session?.user?.id); setVisibleLeft(false); } },
        { label: '退出登录', icon: 'pi pi-sign-out', className: 'text-rose-500', command: () => signOut({ callbackUrl: '/' }) }
    ], [session, profile, openProfileSetupModal, router]);

    const start = (
        <Link href="/dashboard/overview" className="flex items-center gap-3 mr-8 group">
            <div className="relative">
                <img src="/favicon.jpg" alt="logo" className="h-9 w-auto rounded-xl shadow-sm object-contain" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-surface rounded-full"></div>
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tighter text-surface-900">教<span className="text-primary-500">链</span></span>
                <span className="text-[10px] font-bold text-primary-500/80 uppercase mt-0.5">Coach</span>
            </div>
        </Link>
    );

    const end = (
        <div className="flex items-center gap-1 h-10">
            {status === 'loading' ? (
                <Skeleton shape="circle" size="2.5rem" className="bg-surface-100" />
            ) : session?.user ? (
                <>
                    <div className="flex items-center gap-0.5 bg-surface-50 p-1 rounded-2xl mr-2">
                        <button onClick={() => router.push('/messages')} className="relative p-2 rounded-xl text-surface-500 hover:bg-surface hover:text-primary-500 transition-all pi pi-bell p-overlay-badge">
                            <MessageBadge className="absolute top-1.5 right-1.5 border-2 border-surface-50" />
                        </button>
                        <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all pi ${theme === 'light' ? 'pi-moon text-surface-500' : 'pi-sun text-yellow-500'} hover:bg-surface`} />
                    </div>
                    <div className="flex items-center h-full gap-2 pl-1 pr-3 py-1 bg-surface border border-surface-100 rounded-2xl cursor-pointer hover:border-primary-200 transition-all" onClick={(e) => menuRef.current?.toggle(e)}>
                        <Avatar image={profile?.avatar_url || undefined} label={profile?.avatar_url ? undefined : (profile?.nickname?.charAt(0) || 'C')} shape="circle" className="bg-primary-500 text-surface text-xs font-bold" />
                        <div className="hidden md:flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold text-surface-900 truncate max-w-[100px]">{profile?.nickname || '教练'}</span>
                            <span className="text-[10px] text-primary-500 font-medium px-1.5 py-0 bg-primary-50 rounded-full">Coach</span>
                        </div>
                        <ChevronDown size={14} className="ml-1 text-surface-300" />
                    </div>
                </>
            ) : null}
        </div>
    );

    return (
        <>
            {/* Mobile Sidebar */}
            <Sidebar
                visible={visibleLeft}
                onHide={() => setVisibleLeft(false)}
                className="w-[80vw] md:hidden p-0 border-none"
                showCloseIcon={false}
                blockScroll
                pt={{
                    content: {
                        className: 'p-0'
                    },
                    header: { 
                        className: 'bg-surface'
                    },
                }}
                maskClassName="backdrop-blur-sm"
            >
                <div className="flex flex-col h-full bg-surface">
                    <div className="p-6 pt-10 border-b border-surface-50">
                        <div className="flex flex-col gap-4">
                            <Avatar image={profile?.avatar_url || undefined} shape="circle" size="xlarge" className="bg-primary-500 text-surface font-bold shadow-lg" />
                            <div>
                                <h3 className="text-xl font-black text-surface-900 leading-none mb-1">{profile?.nickname || '教练'}</h3>
                                <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-full uppercase">Coach Mode</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-4 px-3">
                        {userMenuItems.map((item, index) => {
                            if (item.separator) return <div key={index} className="h-px bg-surface-100/50 my-2 mx-3" />;
                            return (
                                <button key={index} onClick={() => item.command?.()} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl active:scale-[0.96] ${item.className || 'text-surface-700'}`}>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface-50">
                                        {typeof item.icon === 'string' && <i className={`${item.icon} text-surface-500 text-base`} />}
                                    </div>
                                    <span className="text-sm font-semibold">{item.label as React.ReactNode}</span>
                                    <i className="pi pi-chevron-right ml-auto text-[10px] text-surface-300" />
                                </button>
                            );
                        })}
                    </div>
                    <div className="p-6 border-t border-surface-50 bg-surface flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={toggleTheme} className="w-10 h-10 rounded-xl bg-surface shadow-sm border border-surface-200/50 flex items-center justify-center">
                                {theme === 'light' ? <Moon size={18} className="text-indigo-600" /> : <Sun size={18} className="text-yellow-500" />}
                            </button>
                            <button onClick={() => { router.push('/support'); setVisibleLeft(false); }} className="flex items-center gap-2 px-4 h-10 rounded-xl bg-surface shadow-sm border border-surface-200/50 text-surface-700">
                                <Headphones size={18} />
                                <span className="text-xs font-bold">客服</span>
                            </button>
                        </div>
                        <span className="text-[10px] text-surface-300 font-black italic">V0.0.1</span>
                    </div>
                </div>
            </Sidebar>

            {/* Mobile Top Nav */}
            <div className="md:hidden sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-md border-b border-surface-100">
                <div className="flex items-center h-14 px-4">
                    <div className="flex-1">
                        <button onClick={() => setVisibleLeft(true)} className="p-2 -ml-2 text-surface-600 active:scale-90 transition-transform">
                            <MenuIcon size={24} />
                        </button>
                    </div>
                    <div className="flex-[3] flex justify-center gap-6">
                        {mobileTopTabs.map((tab) => {
                            const isActive = pathname === tab.url;
                            return (
                                <button key={tab.url} onClick={() => router.push(tab.url)} className="relative flex flex-col items-center justify-center h-14">
                                    <span className={`text-[15px] transition-all ${isActive ? 'text-surface-900 font-bold scale-110' : 'text-surface-500 font-medium'}`}>{tab.label}</span>
                                    {isActive && <div className="absolute bottom-2 w-4 h-0.5 bg-primary-500 rounded-full" />}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex-1 flex justify-end">
                        <div className="w-10 h-10" /> {/* Symmetry spacer */}
                    </div>
                </div>
            </div>

            {/* Desktop Menubar */}
            <div className="hidden md:block sticky top-0 z-50 w-full px-4 pt-3 pointer-events-none">
                <Menubar model={coachMenuItems} start={start} end={end} className="max-w-7xl mx-auto pointer-events-auto backdrop-blur-md bg-surface/80 border border-surface/20 shadow-sm rounded-3xl px-6 py-2" />
            </div>

            <Menu model={userMenuItems} popup ref={menuRef} className="mt-2 border-none shadow-xl rounded-2xl p-2 min-w-52 text-sm" />

            {/* Mobile Bottom TabBar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 bg-gradient-to-t from-surface via-surface to-transparent">
                <div className="backdrop-blur-xl bg-surface/90 border border-surface-200/50 shadow-2xl rounded-full px-2 py-1.5">
                    <div className="flex justify-around items-center">
                        {mobileBottomTabs.map((item) => (
                            <button key={item.key} onClick={item.onClick} className={`relative flex flex-col items-center justify-center min-w-[64px] py-1 transition-all active:scale-90 ${item.active ? 'text-primary-600' : 'text-surface-500'}`}>
                                <div className="relative">
                                    <item.icon size={24} strokeWidth={item.active ? 2.5 : 2} />
                                    {item.isMessage && <MessageBadge className="absolute -top-1 -right-1 border-2 border-surface shadow-sm" />}
                                </div>
                                <span className={`text-[10px] mt-0.5 ${item.active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
