'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Plus, Pencil, Trash2, Calendar,
    Clock, Bookmark, MoreVertical
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
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

    const renderPlanCard = (favorite: StudentPlanFavoriteRow) => {
        const isMenuOpen = activeMenuId === favorite.id;
        const dayCount = Array.isArray(favorite.training_days) ? favorite.training_days.length : 0;

        return (
            <div
                key={favorite.id}
                onClick={() => handleEditPlan(favorite)}
                className="bg-surface-0 border border-surface-100 p-4 sm:p-5 rounded-2xl mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
            >
                <div className="flex items-start justify-between gap-4 pr-16 sm:pr-20">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black text-surface-900 tracking-tight uppercase truncate">
                                {favorite.name}
                            </h3>
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
                </div>

                {/* 右下角应用按钮 */}
                <button
                    onClick={(e) => { e.stopPropagation(); handleApplyPlan(favorite); }}
                    className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 flex items-center justify-center bg-primary-600 text-surface-0 px-4 py-2 rounded-2xl shadow-sm hover:shadow-md transition-all"
                    title="应用计划"
                >
                    <span className="text-sm font-black uppercase">应用</span>
                </button>

                {/* PC 端：右上角操作按钮 */}
                <div className="hidden sm:flex absolute top-4 right-4 items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEditPlan(favorite); }}
                        className="w-10 h-10 rounded-xl bg-surface-100 text-surface-600 flex items-center justify-center hover:bg-surface-200 transition-all"
                        title="编辑"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePlan(favorite); }}
                        className="w-10 h-10 rounded-xl bg-surface-100 text-surface-600 flex items-center justify-center hover:bg-surface-200 transition-all"
                        title="删除"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* 移动端：右上角菜单按钮 */}
                <div className="sm:hidden absolute top-4 right-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : favorite.id); }}
                        className="w-10 h-10 rounded-xl bg-surface-100 text-surface-600 flex items-center justify-center transition-all"
                    >
                        <MoreVertical size={18} />
                    </button>

                    {isMenuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-12 z-20 bg-surface-0 border border-surface-100 rounded-2xl shadow-lg p-2 min-w-[120px]"
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlan(favorite); setActiveMenuId(null); }}
                                    className="w-full px-4 py-2.5 rounded-xl bg-surface-100 text-surface-700 text-sm font-bold flex items-center gap-2 transition-all"
                                >
                                    <Trash2 size={14} />
                                    删除
                                </button>
                            </motion.div>
                        </>
                    )}
                </div>
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
                        className="bg-surface-900 text-surface-0 p-3 rounded-2xl transition-all shadow-sm flex items-center gap-2"
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
                            className="px-8 py-3 bg-primary-600 text-surface-0 rounded-2xl font-black  shadow-lg shadow-primary-500/20 transition-all"
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