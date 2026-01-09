'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Paginator } from 'primereact/paginator';
import { useToastContext } from '@/context/ToastContext';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import StudentActionEditDialog from './StudentActionEditDialog';
import CopyCoachActionDialog from './CopyCoachActionDialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { StudentActionRow } from '@/types/student';

const StudentActionLib = () => {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    // 普通分页数据
    const [actions, setActions] = useState<StudentActionRow[]>([]);
    // 搜索结果数据
    const [searchResults, setSearchResults] = useState<StudentActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchTotalRecords, setSearchTotalRecords] = useState(0);
    const [editingAction, setEditingAction] = useState<StudentActionRow | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [copyDialogVisible, setCopyDialogVisible] = useState(false);

    const { showToast } = useToastContext();
    const itemsPerPage = 12;

    // 加载动作列表
    useEffect(() => {
        if (!userId) return;

        // 搜索模式下不加载普通列表
        if (searchTerm) return;

        loadActions();
    }, [userId, currentPage]);

    const loadActions = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const res = await studentActionLibService.listActions({
                search: undefined,
                page: currentPage,
                limit: itemsPerPage
            });

            if (res) {
                setActions(res.actions);
                setTotalRecords(res.totalCount);
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

    const handleEditAction = async (action: StudentActionRow) => {
        setEditingAction(action);
        setDialogVisible(true);
    };

    const handleDeleteAction = (action: StudentActionRow) => {
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
            await studentActionLibService.deleteAction({ id: actionId });
            showToast({ severity: 'success', summary: '删除成功', detail: '动作已删除' });

            // 重新加载当前数据
            if (searchTerm) {
                handleSearch();
            } else {
                loadActions();
            }
        } catch (error) {
            console.error('删除动作失败:', error);
            showToast({ severity: 'error', summary: '删除失败', detail: '无法删除动作' });
        }
    };

    const handleSaveAction = async (actionData: Partial<StudentActionRow>) => {
        try {
            if (editingAction) {
                // 更新动作
                await studentActionLibService.updateAction({
                    id: editingAction.id,
                    name: actionData.name || '',
                    detail: actionData.detail,
                    url: actionData.url,
                    positions: actionData.positions,
                    attrs: actionData.attrs,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute,
                    includesBodyWeight: actionData.includesBodyWeight,
                    canonical_action_id: actionData.canonical_action_id
                });
                showToast({ severity: 'success', summary: '更新成功', detail: '动作已更新' });
            } else {
                // 添加新动作
                await studentActionLibService.addAction({
                    name: actionData.name || '',
                    detail: actionData.detail,
                    url: actionData.url,
                    positions: actionData.positions,
                    attrs: actionData.attrs,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute,
                    includesBodyWeight: actionData.includesBodyWeight,
                    canonical_action_id: actionData.canonical_action_id
                });
                showToast({ severity: 'success', summary: '添加成功', detail: '新动作已添加' });
            }

            setDialogVisible(false);

            // 重新加载当前数据
            if (searchTerm) {
                handleSearch();
            } else {
                loadActions();
            }
        } catch (error: any) {
            console.error('保存动作失败:', error);
            showToast({ 
                severity: 'error', 
                summary: '保存失败', 
                detail: error?.message || '无法保存动作' 
            });
        }
    };

    const handleSearch = async () => {
        if (!userId) return;

        setSearching(true);

        try {
            const res = await studentActionLibService.listActions({
                search: searchTerm || undefined,
                page: 1,
                limit: itemsPerPage
            });

            if (res) {
                setSearchResults(res.actions);
                setSearchTotalRecords(res.totalCount);
                setCurrentPage(1);
            }
        } catch (error) {
            console.error('搜索动作失败:', error);
            showToast({ severity: 'error', summary: '搜索失败', detail: '无法搜索动作' });
        } finally {
            setSearching(false);
        }
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        setCurrentPage(newPage);
    };

    const renderActionCard = (action: StudentActionRow) => {
        const positions = action.positions || [];

        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:shadow-sm transition-all mb-2">
                <div className="flex justify-between gap-3">
                    {/* 左侧内容 */}
                    <div className="flex-1 min-w-0">
                        {/* 名称 */}
                        <h3 className="text-lg font-semibold text-900 mb-2 line-clamp-1">
                            {action.name}
                        </h3>

                        {/* 描述 */}
                        <p className="text-600 text-sm mb-3 line-clamp-2">
                            {action.detail}
                        </p>

                        {/* 标签区域 */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {positions.map((pos, index) => (
                                <span
                                    key={index}
                                    className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700"
                                >
                                    {pos}
                                </span>
                            ))}

                            {action.url && (
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                    包含演示
                                </span>
                            )}

                            {action.attrs && action.attrs.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                    属性: {action.attrs.length}
                                </span>
                            )}

                            {action.enableAutoWeightCompute && (
                                <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                    <i className="pi pi-bolt text-xs mr-1" />
                                    智能计算
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 右侧操作按钮 */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
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

    // 确定当前应该显示的数据
    const getCurrentData = () => {
        if (searchTerm) {
            return searchResults;
        }
        return actions;
    };

    // 确定当前的总记录数
    const getCurrentTotalRecords = () => {
        if (searchTerm) {
            return searchTotalRecords;
        }
        return totalRecords;
    };

    // 确定是否应该显示骨架屏
    const shouldShowSkeleton = () => {
        return loading || searching;
    };

    return (
        <div className="mx-auto p-4">
            <ConfirmDialog />
            <StudentActionEditDialog
                visible={dialogVisible}
                action={editingAction}
                onSave={handleSaveAction}
                onCancel={() => setDialogVisible(false)}
            />
            <CopyCoachActionDialog
                visible={copyDialogVisible}
                onHide={() => setCopyDialogVisible(false)}
                onSuccess={() => {
                    // 重新加载动作列表
                    if (searchTerm) {
                        handleSearch();
                    } else {
                        loadActions();
                    }
                }}
            />

            <Card className="shadow-sm">
                {/* 顶部区域 */}
                <div className="border-b border-surface-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">我的动作库</h1>
                            <p className="text-600 mt-1">管理您的训练动作</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                label="从教练添加"
                                icon="pi pi-download"
                                className="p-button-outlined"
                                onClick={() => setCopyDialogVisible(true)}
                            />
                            <Button
                                label="自定义动作"
                                icon="pi pi-plus"
                                onClick={handleAddAction}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mt-6">
                        <div className="flex-1">
                            <IconField iconPosition="left" className='w-full'>
                                <InputIcon className="pi pi-search"> </InputIcon>
                                <InputText
                                    value={searchTerm}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearchTerm(value);

                                        if (!value) {
                                            setSearchResults([]);
                                            setSearchTotalRecords(0);
                                        }
                                    }}
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
                    {shouldShowSkeleton() ? (
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
                    ) : getCurrentData().length === 0 && !searchTerm ? (
                        <div className="text-center py-12">
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
                                value={getCurrentData()}
                                itemTemplate={renderActionCard}
                                emptyMessage="未找到匹配的动作"
                            />
                            <div className="mt-4">
                                <Paginator
                                    first={(currentPage - 1) * itemsPerPage}
                                    rows={itemsPerPage}
                                    totalRecords={getCurrentTotalRecords()}
                                    onPageChange={(e) => {
                                        console.log('Using Paginator onPageChange:', e);
                                        const newPage = (e.first / e.rows) + 1;
                                        setCurrentPage(newPage);
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default StudentActionLib;
