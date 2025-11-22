'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { actionLibService } from '@/app/service/actionLibService';
import ActionEditDialog from './ActionEditDialog';
import { ExerciseAction } from '@/app/api/action-lib/get-actions/entity';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';

const ActionLib = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const [actions, setActions] = useState<ExerciseAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [editingAction, setEditingAction] = useState<ExerciseAction | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedAction, setSelectedAction] = useState<ExerciseAction | null>(null);

    const { showToast } = useToastContext();
    const itemsPerPage = 12;

    // 加载动作列表
    useEffect(() => {
        if (!coach?.id) return;
        loadActions();
    }, [coach?.id, currentPage, searchTerm]);

    const loadActions = async () => {
        if (!coach?.id) return;

        setLoading(true);
        try {
            const res = await actionLibService.getActions({
                coach_id: coach.id,
                search: searchTerm || undefined,
                page: currentPage,
                limit: itemsPerPage
            });

            if (res) {
                setActions(res.actions);
                setTotalRecords(res.total);
            }
        } catch (error) {
            console.error('加载动作列表失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作列表' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddAction = () => {
        setEditingAction(null);
        setDialogVisible(true);
    };

    const handleEditAction = async (action: ExerciseAction) => {
        try {
            const res = await actionLibService.getAction({ id: action.id });
            if (res?.action) {
                setEditingAction(res.action);
                setDialogVisible(true);
            }
        } catch (error) {
            console.error('加载动作详情失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作详情' });
        }
    };

    const handleDeleteAction = (action: ExerciseAction) => {
        confirmDialog({
            message: `确定要删除动作"${action.name}"吗？此操作无法撤销。`,
            header: '删除确认',
            icon: 'pi pi-exclamation-triangle',
            accept: () => deleteAction(action.id),
            reject: () => { }
        });
    };

    const deleteAction = async (actionId: string) => {
        try {
            await actionLibService.deleteAction({ id: actionId });
            showToast({ severity: 'success', summary: '删除成功', detail: '动作已删除' });
            loadActions(); // 重新加载列表
        } catch (error) {
            console.error('删除动作失败:', error);
            showToast({ severity: 'error', summary: '删除失败', detail: '无法删除动作' });
        }
    };

    const handleSaveAction = async (actionData: Partial<ExerciseAction>) => {
        try {
            if (editingAction) {
                // 更新动作
                await actionLibService.updateAction({
                    id: editingAction.id,
                    ...actionData
                });
                showToast({ severity: 'success', summary: '更新成功', detail: '动作已更新' });
            } else {
                // 添加新动作
                if (!coach?.id) return;

                await actionLibService.addAction({
                    coach_id: coach.id,
                    name: actionData.name || '',
                    description: actionData.description || '',
                    video_url: actionData.video_url,
                    type: actionData.type || 'strength'
                });
                showToast({ severity: 'success', summary: '添加成功', detail: '新动作已添加' });
            }

            setDialogVisible(false);
            loadActions(); // 重新加载列表
        } catch (error) {
            console.error('保存动作失败:', error);
            showToast({ severity: 'error', summary: '保存失败', detail: '无法保存动作' });
        }
    };

    const handleSearch = () => {
        setCurrentPage(1); // 重置到第一页
        loadActions();
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        setCurrentPage(newPage);
    };

    const renderActionCard = (action: ExerciseAction) => {
        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:bg-surface-50 transition-colors">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-900 mb-2">{action.name}</h3>
                        <p className="text-600 mb-3 line-clamp-2">
                            {action.description}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-surface-100 text-surface-700 rounded-full">
                                {getActionTypeLabel(action.type)}
                            </span>
                            {action.video_url && (
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                    有视频
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                        <Button
                            icon="pi pi-pencil"
                            className="p-button-rounded p-button-text"
                            tooltip="编辑"
                            onClick={() => handleEditAction(action)}
                        />
                        <Button
                            icon="pi pi-trash"
                            className="p-button-rounded p-button-text p-button-danger"
                            tooltip="删除"
                            onClick={() => handleDeleteAction(action)}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const getActionTypeLabel = (type: string) => {
        const typeLabels: Record<string, string> = {
            'strength': '力量',
            'cardio': '心肺',
            'flexibility': '柔韧性',
            'other': '其他'
        };
        return typeLabels[type] || type;
    };

    return (
        <div className="max-w-6xl mx-auto">
            <ConfirmDialog />
            <ActionEditDialog
                visible={dialogVisible}
                action={editingAction}
                onSave={handleSaveAction}
                onCancel={() => setDialogVisible(false)}
            />

            <Card className="shadow-sm">
                {/* 顶部区域 */}
                <div className="border-b border-surface-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">动作库管理</h1>
                            <p className="text-600 mt-1">管理您的训练动作库</p>
                        </div>
                        <Button
                            label="添加动作"
                            icon="pi pi-plus"
                            onClick={handleAddAction}
                        />
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mt-6">
                        <div className="flex-1">
                            <IconField iconPosition="left" className='w-full'>
                                <InputIcon className="pi pi-search"> </InputIcon>
                                <InputText
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="搜索动作名称或描述..."
                                    className="w-full"
                                />
                            </IconField>

                        </div>
                        <Button
                            label="搜索"
                            icon="pi pi-search"
                            onClick={handleSearch}
                        />
                    </div>
                </div>

                {/* 动作列表区域 */}
                <div className="p-4 md:p-6">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="border rounded-lg p-4">
                                    <Skeleton width="100%" height="1.5rem" className="mb-3" />
                                    <Skeleton width="80%" height="1rem" className="mb-2" />
                                    <Skeleton width="60%" height="1rem" className="mb-4" />
                                    <div className="flex justify-between">
                                        <Skeleton width="3rem" height="1.5rem" />
                                        <div className="flex gap-1">
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : actions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="bg-surface-100 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <i className="pi pi-bolt text-2xl text-surface-500"></i>
                            </div>
                            <h3 className="text-lg font-semibold text-900 mb-2">暂无动作</h3>
                            <p className="text-600 mb-6">开始添加您的第一个训练动作</p>
                            <Button
                                label="添加动作"
                                icon="pi pi-plus"
                                onClick={handleAddAction}
                            />
                        </div>
                    ) : (
                        <>
                            <DataView
                                value={actions}
                                itemTemplate={renderActionCard}
                                paginator
                                rows={itemsPerPage}
                                totalRecords={totalRecords}
                                first={(currentPage - 1) * itemsPerPage}
                                onPage={onPageChange}
                                emptyMessage="未找到匹配的动作"
                            />
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ActionLib;