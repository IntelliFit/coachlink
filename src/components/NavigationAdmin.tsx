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
import { useSession, signOut, getSession } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { adminService } from '@/app/service/adminService';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';
import type { UserProfilesRow } from '@/types';
import { Bell, Moon, Sun, CreditCard, UserPlus, Trophy, LogIn, Settings, FileText, Database, Dumbbell, MessageSquare } from 'lucide-react';

export default function NavigationAdmin() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const sessionUser = session?.user as { id?: string; is_admin?: boolean } | undefined;
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);
    const { showToast } = useToastContext();
    const [navData, setNavData] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfilesRow | null>(null);

    const loadNavData = async () => {
        try {
            const res = await adminService.adminNavData({});
            if (res) setNavData(res);
        } catch (e) {
            console.error("Nav data error", e);
        }
    };

    useEffect(() => {
        setIsClient(true);
        loadNavData();
    }, []);

    // PWA 恢复时主动刷新 session（解决 Android Chrome 息屏后 session 丢失问题）
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
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
        if (status !== 'authenticated' || !sessionUser?.id) {
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
    }, [status, sessionUser?.id]);

    const itemRenderer = (item: any) => (
        <div 
            onClick={item.command}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-all duration-200
                ${pathname === item.url ? 'bg-primary-50 text-primary-600' : 'hover:bg-surface-50 text-surface-600'}
            `}
        >
            <item.icon size={18} strokeWidth={2.5} />
            <span className="text-sm font-semibold">{item.label}</span>
            {item.badge > 0 && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-surface ring-2 ring-surface">
                    {item.badge}
                </span>
            )}
        </div>
    );

    const adminMenuItems = useMemo(() => [
        {
            label: '支付管理',
            icon: CreditCard,
            url: '/admin/payments',
            command: () => router.push('/admin/payments'),
            template: itemRenderer
        },
        {
            label: '订阅管理',
            icon: FileText,
            url: '/admin/subscriptions',
            command: () => router.push('/admin/subscriptions'),
            badge: navData?.paymentUnreviewed || 0,
            template: itemRenderer
        },
        {
            label: '内容导入',
            icon: Database,
            url: '/admin/content-import',
            command: () => router.push('/admin/content-import'),
            template: itemRenderer
        },
        {
            label: '标准动作库',
            icon: Dumbbell,
            url: '/admin/canonical-actions',
            command: () => router.push('/admin/canonical-actions'),
            template: itemRenderer
        },
        {
            label: '意见反馈',
            icon: MessageSquare,
            url: '/admin/feedback',
            command: () => router.push('/admin/feedback'),
            badge: navData?.feedbackOpen || 0,
            template: itemRenderer
        },
        {
            label: '教练申请',
            icon: UserPlus,
            url: '/admin/coach-applications',
            command: () => router.push('/admin/coach-applications'),
            badge: navData?.coachApplicationUnreviewed || 0,
            template: itemRenderer
        },
        {
            label: '排行榜',
            icon: Trophy,
            url: '/admin/rankings',
            command: () => router.push('/admin/rankings'),
            template: itemRenderer
        },
        {
            label: '数据分析',
            icon: Settings,
            url: '/admin/analytics',
            command: () => router.push('/admin/analytics'),
            template: itemRenderer
        },
        {
            label: '平台设置',
            icon: Settings,
            url: '/admin/settings',
            command: () => router.push('/admin/settings'),
            template: itemRenderer
        }
    ], [router, navData, pathname]);

    const userMenuItems = useMemo(() => [
        {
            label: '个人设置',
            icon: 'pi pi-cog',
            command: () => openProfileSetupModal(profile, sessionUser?.id),
        },
        { separator: true },
        {
            label: '退出登录',
            icon: 'pi pi-sign-out',
            className: 'text-rose-500',
            command: () => signOut({ callbackUrl: '/admin/login' }),
        }
    ], [session, profile, openProfileSetupModal]);

    const start = (
        <Link href="/" className="flex items-center gap-3 mr-8 group transition-transform active:scale-95">
            <div className="relative">
                {/* 统一保持原比例：使用 h-9 w-auto 和 object-contain */}
                <img src="/favicon.jpg" alt="logo" className="h-9 w-auto rounded-xl shadow-sm group-hover:shadow-primary-100 transition-all object-contain" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 border-2 border-surface rounded-full"></div>
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tighter text-surface-900">
                    教<span className="text-primary-500">链</span>
                </span>
                <span className="text-[10px] font-bold text-primary-500/80 uppercase mt-0.5">Admin</span>
            </div>
        </Link>
    );

    const end = (
        <div className="flex items-center gap-1 h-10"> {/* 强制 h-10 与 Student 端保持一致高度 */}
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
                            image={profile?.avatar_url || undefined}
                            label={profile?.avatar_url ? undefined : (profile?.nickname?.charAt(0) || 'A')}
                            shape="circle"
                            className="bg-primary-500 text-surface text-xs font-bold inner-img-object-fit"
                        />
                        <div className="hidden md:flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold text-surface-900 truncate max-w-[100px]">
                                {profile?.nickname || '管理员'}
                            </span>
                            <span className="text-[10px] text-primary-500 font-medium px-1.5 py-0 bg-primary-50 rounded-full">
                                Root
                            </span>
                        </div>
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
                    model={adminMenuItems}
                    start={start}
                    end={end}
                    className="max-w-7xl mx-auto pointer-events-auto backdrop-blur-md bg-surface/80 border border-surface/20 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl px-6 py-2 transition-all"
                />
            </div>

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                className="mt-2 border-none shadow-xl rounded-2xl p-2 min-w-48 text-sm font-medium"
            />
        </>
    );
}
