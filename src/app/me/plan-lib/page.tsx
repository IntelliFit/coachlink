'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Play, Pencil, Trash2, Calendar,
    Clock, ChevronRight, Bookmark, AlertCircle
} from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useSession } from 'next-auth/react';
import { useToastContext } from '@/context/ToastContext';
import { studentPlanLibService } from '@/app/service/studentPlanLibService';
import { StudentPlanFavoriteRow } from '@/types/student';

const StudentPlanLib = () => {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const router = useRouter();
    const { showToast } = useToastContext();

    const [favorites, setFavorites] = useState<StudentPlanFavoriteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (userId) loadFavorites();
    }, [userId]);

    const loadFavorites = async () => {
        setLoading(true);
        try {
            const res = await studentPlanLibService.listFavorites({ page: 1, limit: 50 });
            if (res) setFavorites(res.favorites);
        } catch (error: any) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取计划库' });
        } finally {
            setLoading(false);
        }
    };

    // --- 动画配置 ---
    const inertialSpring = { type: "spring", stiffness: 400, damping: 30, mass: 1 } as const;

    const renderPlanCard = (favorite: StudentPlanFavoriteRow) => {
        const isExpanded = activeId === favorite.id;
        const dayCount = Array.isArray(favorite.training_days) ? favorite.training_days.length : 0;

        return (
            <div key={favorite.id} className="relative overflow-hidden rounded-2xl mb-3">
                {/* 底层操作区 (Action Drawer) */}
                <div className="absolute inset-y-0 right-0 flex items-center px-4 gap-2">
                    <button
                        onClick={() => handleEditPlan(favorite)}
                        className="w-12 h-12 rounded-xl bg-surface-100 text-surface-600 flex items-center justify-center active:scale-90 transition-all"
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        onClick={() => handleDeletePlan(favorite)}
                        className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-all"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* 表层内容卡片 */}
                <motion.div
                    onClick={() => setActiveId(isExpanded ? null : favorite.id)}
                    whileTap={{ scale: 0.98 }}
                    animate={{ x: isExpanded ? -130 : 0 }}
                    transition={inertialSpring}
                    className={`
                        relative z-10 bg-surface-0 border border-surface-100 p-4 sm:p-5 rounded-2xl
                        flex items-center justify-between gap-4 cursor-pointer
                        ${isExpanded ? 'shadow-lg border-surface-200' : 'shadow-sm'}
                    `}
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black text-surface-900 tracking-tight  uppercase truncate">
                                {favorite.name}
                            </h3>
                            {isExpanded && <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />}
                        </div>

                        <p className="text-sm font-medium text-surface-500 line-clamp-1 mb-3">
                            {favorite.description || '无描述文本'}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-widest">
                                <Calendar size={10} /> {dayCount} 训练日
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-50 text-surface-400 text-[10px] font-black uppercase tracking-widest">
                                <Clock size={10} /> {new Date(favorite.updated_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* 应用计划按钮：采用强调色联动 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleApplyPlan(favorite); }}
                            className="flex flex-col items-center justify-center bg-primary-600 text-surface-0 h-14 w-14 rounded-2xl shadow-sm active:scale-95 transition-all"
                        >
                            <Play size={20} fill="currentColor" />
                            <span className="text-[9px] font-black mt-1  uppercase">应用</span>
                        </button>
                        <ChevronRight size={20} className={`text-surface-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </motion.div>
            </div>
        );
    };

    // --- 业务逻辑处理 (保持不变，但优化提示) ---
    const handleApplyPlan = (fav: StudentPlanFavoriteRow) => {
        confirmDialog({
            header: '应用计划',
            message: `立即开始执行「${fav.name}」吗？`,
            acceptLabel: '开始训练',
            rejectLabel: '再想想',
            className: 'aero-dialog',
            accept: async () => {
                try {
                    await studentPlanLibService.applyFavorite({ favoriteId: fav.id });
                    showToast({ severity: 'success', summary: '成功', detail: '计划已激活' });
                    router.push('/today-training');
                } catch (e: any) {
                    showToast({ severity: 'error', summary: '失败', detail: e.message });
                }
            }
        });
    };

    const handleDeletePlan = (fav: StudentPlanFavoriteRow) => {
        confirmDialog({
            header: '移除确认',
            message: '确定要删除此训练模板吗？',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                await studentPlanLibService.deleteFavorite({ id: fav.id });
                loadFavorites();
            }
        });
    };

    const handleEditPlan = (fav: StudentPlanFavoriteRow) => router.push(`/me/plan-lib/edit/${fav.id}`);

    return (
        <div className="min-h-screen pb-20">
            <ConfirmDialog />

            {/* 头部：容器与深度逻辑 */}
            <div className="sticky top-0 z-20 backdrop-blur-md border-b border-surface-100">
                <div className="max-w-3xl mx-auto px-5 py-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-surface-900  tracking-tight uppercase">常用计划库</h1>
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] mt-1">Plan Library</p>
                    </div>
                    <button
                        onClick={() => router.push('/me/plan-lib/create')}
                        className="bg-surface-900 text-surface-0 p-3 rounded-2xl active:scale-95 transition-all shadow-sm flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline text-sm font-black ">新建</span>
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-5">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-surface-0 rounded-2xl p-5 border border-surface-100">
                                <Skeleton width="40%" height="1.2rem" className="mb-3" />
                                <Skeleton width="90%" height="1rem" className="mb-4" />
                                <div className="flex justify-between items-center">
                                    <Skeleton width="100px" height="20px" borderRadius="8px" />
                                    <Skeleton width="48px" height="48px" borderRadius="12px" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-surface-100 rounded-[32px] flex items-center justify-center mb-6">
                            <Bookmark size={32} className="text-surface-300" />
                        </div>
                        <h3 className="text-lg font-black text-surface-900  uppercase">空空如也</h3>
                        <p className="text-sm text-surface-400 mt-2 mb-8">还没有收藏任何训练计划模板</p>
                        <button
                            onClick={() => router.push('/me/plan-lib/create')}
                            className="px-8 py-3 bg-primary-600 text-surface-0 rounded-2xl font-black  shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
                        >
                            创建第一个计划
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {favorites.map(renderPlanCard)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentPlanLib;