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
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { coachService } from '@/app/service/coachService';
import {
    LayoutDashboard,
    PlayCircle,
    Users,
    FileEdit,
    ClipboardList,
    Bell,
    Moon,
    Sun,
    ChevronDown,
    LogIn
} from 'lucide-react';

export default function NavigationCoach() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const gotoCoachDisplayPage = async () => {
        const res = await coachService.getCoach({
            userId: session?.user?.id || ''
        });
        if (res && res.coach) {
            router.push('/coach/profile/' + res.coach.id);
        }
    }

    // 统一的菜单项渲染器
    const itemRenderer = (item: any) => {
        const isActive = pathname === item.url;
        return (
            <div
                onClick={item.command}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-all duration-300
                    ${isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'hover:bg-surface-50 text-surface-600 hover:text-primary-600'}
                `}
            >
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
        { label: '我的主页', icon: 'pi pi-home', command: () => gotoCoachDisplayPage() },
        { label: '我的钱包', icon: 'pi pi-wallet', command: () => router.push('/dashboard/wallet') }, // Added Wallet Entry
        { label: '动作库', icon: 'pi pi-database', command: () => router.push('/dashboard/action-lib') },
        { label: '订阅设置', icon: 'pi pi-tags', command: () => router.push('/dashboard/pricing') }, // Changed icon to distinguish from wallet
        { label: '收款码设置', icon: 'pi pi-qrcode', command: () => router.push('/coach/settings/payment') },
        { label: '学员问卷', icon: 'pi pi-file-edit', command: () => router.push('/dashboard/questionnaire') },
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
        { label: '个人设置', icon: 'pi pi-cog', command: () => openProfileSetupModal(session?.profile, session?.user?.id) },
        { label: '退出登录', icon: 'pi pi-sign-out', className: 'text-rose-500', command: () => signOut({ callbackUrl: '/' }) }
    ], [session, openProfileSetupModal, router]);

    const start = (
        <Link href="/dashboard/overview" className="flex items-center gap-3 mr-8 group transition-transform active:scale-95">
            <div className="relative">
                <img src="/favicon.jpg" alt="logo" className="h-9 w-auto rounded-xl shadow-sm object-contain" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-surface rounded-full"></div>
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tighter text-surface-900">
                    教<span className="text-primary-500">链</span>
                </span>
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
                        className="flex items-center h-full gap-2 pl-1 pr-3 py-1 bg-surface border border-surface-100 rounded-2xl cursor-pointer hover:border-primary-200 transition-all active:scale-[0.97]"
                        onClick={(e) => menuRef.current?.toggle(e)}
                    >
                        <Avatar
                            image={session.profile?.avatar_url || undefined}
                            label={session.profile?.avatar_url ? undefined : (session.profile?.nickname?.charAt(0) || 'C')}
                            shape="circle"
                            className="bg-primary-500 text-surface text-xs font-bold"
                        />
                        <div className="hidden md:flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold text-surface-900 truncate max-w-[100px]">
                                {session.profile?.nickname || '教练'}
                            </span>
                            <span className="text-[10px] text-primary-500 font-medium px-1.5 py-0 bg-primary-50 rounded-full">
                                Coach
                            </span>
                        </div>
                        <ChevronDown size={14} className="ml-1 text-surface-300" />
                    </div>
                </>
            ) : (
                <Button
                    onClick={() => router.push('/login')}
                    rounded
                    className="bg-primary-500 border-none px-5 py-2 hover:bg-primary-600 transition-all shadow-md shadow-primary-100"
                >
                    <LogIn size={18} className="mr-2" />
                    <span className="font-bold text-sm">登录</span>
                </Button>
            )}
        </div>
    );

    return (
        <>
            <div className="sticky top-0 z-50 w-full px-4 pt-3 pointer-events-none">
                <Menubar
                    model={coachMenuItems}
                    start={start}
                    end={end}
                    className="max-w-7xl mx-auto pointer-events-auto backdrop-blur-md bg-surface/80 border border-surface/20 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl px-6 py-2"
                />
            </div>

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                className="mt-2 border-none shadow-xl rounded-2xl p-2 min-w-52 text-sm font-medium"
            />
        </>
    );
}