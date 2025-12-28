'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { studentPlanLibService } from '@/app/service/studentPlanLibService';
import { StudentPlanFavoriteRow } from '@/types/student';

const StudentPlanLib = () => {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const router = useRouter();

    const [favorites, setFavorites] = useState<StudentPlanFavoriteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const { showToast } = useToastContext();
    const itemsPerPage = 12;

    useEffect(() => {
        if (!userId) return;
        loadFavorites();
    }, [userId, currentPage]);

    const loadFavorites = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const res = await studentPlanLibService.listFavorites({
                page: currentPage,
                limit: itemsPerPage
            });

            if (res) {
                setFavorites(res.favorites);
                setTotalRecords(res.totalCount);
            }
        } catch (error: any) {
            console.error('加载常用计划失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: error?.message || '无法加载常用计划' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlan = () => {
        router.push('/me/plan-lib/create');
    };

    const handleEditPlan = (favorite: StudentPlanFavoriteRow) => {
        router.push(`/me/plan-lib/edit/${favorite.id}`);
    };

    const handleDeletePlan = (favorite: StudentPlanFavoriteRow) => {
        confirmDialog({
            message: `确定要删除计划"${favorite.name}"吗？此操作无法撤销。`,
            header: '删除确认',
            icon: 'pi pi-exclamation-triangle',
            accept: () => deletePlan(favorite.id),
            reject: () => { }
        });
    };

    const deletePlan = async (id: string) => {
        try {
            await studentPlanLibService.deleteFavorite({ id });
            showToast({ severity: 'success', summary: '删除成功', detail: '常用计划已删除' });
            loadFavorites();
        } catch (error: any) {
            console.error('删除常用计划失败:', error);
            showToast({ severity: 'error', summary: '删除失败', detail: error?.message || '无法删除常用计划' });
        }
    };

    const handleApplyPlan = (favorite: StudentPlanFavoriteRow) => {
        confirmDialog({
            message: `确定要应用计划"${favorite.name}"吗？将从今天开始执行此计划。`,
            header: '应用计划',
            icon: 'pi pi-play',
            acceptLabel: '开始执行',
            rejectLabel: '取消',
            accept: () => applyPlan(favorite),
            reject: () => { }
        });
    };

    const applyPlan = async (favorite: StudentPlanFavoriteRow) => {
        try {
            const result = await studentPlanLibService.applyFavorite({
                favoriteId: favorite.id
            });
            showToast({ 
                severity: 'success', 
                summary: '应用成功', 
                detail: result.message 
            });
            // 跳转到今日训练页面
            router.push('/today-training');
        } catch (error: any) {
            console.error('应用计划失败:', error);
            showToast({ 
                severity: 'error', 
                summary: '应用失败', 
                detail: error?.message || '无法应用计划' 
            });
        }
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        setCurrentPage(newPage);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const renderPlanCard = (favorite: StudentPlanFavoriteRow) => {
        const trainingDays = favorite.training_days || [];
        const dayCount = Array.isArray(trainingDays) ? trainingDays.length : 0;

        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:shadow-sm transition-all mb-2">
                <div className="flex justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-900 mb-2 line-clamp-1">
                            {favorite.name}
                        </h3>

                        <p className="text-600 text-sm mb-3 line-clamp-2">
                            {favorite.description || '暂无描述'}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700">
                                {dayCount} 个训练日
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                更新于 {formatDate(favorite.updated_at)}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 shrink-0">
                        <Button
                            icon="pi pi-play"
                            className="p-button-rounded p-button-text p-button-success"
                            tooltip="应用计划"
                            onClick={() => handleApplyPlan(favorite)}
                        />
                        <Button
                            icon="pi pi-pencil"
                            className="p-button-rounded p-button-text"
                            tooltip="编辑"
                            onClick={() => handleEditPlan(favorite)}
                        />
                        <Button
                            icon="pi pi-trash"
                            className="p-button-rounded p-button-text p-button-danger"
                            tooltip="删除"
                            onClick={() => handleDeletePlan(favorite)}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto p-4">
            <ConfirmDialog />

            <Card className="shadow-sm">
                <div className="border-b border-surface-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">常用计划</h1>
                            <p className="text-600 mt-1">创建和管理您的训练计划模板</p>
                        </div>
                        <Button
                            label="创建计划"
                            icon="pi pi-plus"
                            onClick={handleCreatePlan}
                        />
                    </div>
                </div>

                <div className="p-4 md:p-6">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="border rounded-lg p-4">
                                    <Skeleton width="100%" height="1.5rem" className="mb-3" />
                                    <Skeleton width="80%" height="1rem" className="mb-2" />
                                    <Skeleton width="60%" height="1rem" className="mb-4" />
                                    <div className="flex justify-between">
                                        <Skeleton width="4rem" height="1.5rem" />
                                        <div className="flex gap-1">
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : favorites.length === 0 ? (
                        <div className="text-center py-12">
                            <i className="pi pi-bookmark text-5xl text-surface-300 mb-4"></i>
                            <h3 className="text-lg font-semibold text-900 mb-2">暂无常用计划</h3>
                            <p className="text-600 mb-6">创建您的第一个训练计划模板</p>
                            <Button
                                label="创建计划"
                                icon="pi pi-plus"
                                onClick={handleCreatePlan}
                            />
                        </div>
                    ) : (
                        <DataView
                            value={favorites}
                            itemTemplate={renderPlanCard}
                            paginator
                            rows={itemsPerPage}
                            totalRecords={totalRecords}
                            first={(currentPage - 1) * itemsPerPage}
                            onPage={onPageChange}
                            emptyMessage="暂无常用计划"
                        />
                    )}
                </div>
            </Card>
        </div>
    );
};

export default StudentPlanLib;
