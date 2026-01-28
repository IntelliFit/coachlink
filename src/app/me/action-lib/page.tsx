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
import { TabView, TabPanel } from 'primereact/tabview';
import { useToastContext } from '@/context/ToastContext';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { publicActionLibService } from '@/app/service/publicActionLibService';
import StudentActionEditDialog from './StudentActionEditDialog';
import CopyCoachActionDialog from './CopyCoachActionDialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { StudentActionRow } from '@/types/student';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';
import PublicActionDetailDialog from '@/components/action-lib/PublicActionDetailDialog';

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

    // 公共动作库数据
    const [publicActions, setPublicActions] = useState<PublicActionItemDto[]>([]);
    const [publicLoading, setPublicLoading] = useState(false);
    const [publicSearching, setPublicSearching] = useState(false);
    const [publicSearchTerm, setPublicSearchTerm] = useState('');
    const [publicCurrentPage, setPublicCurrentPage] = useState(1);
    const [publicTotalRecords, setPublicTotalRecords] = useState(0);
    const [publicDetailVisible, setPublicDetailVisible] = useState(false);
    const [publicDetailAction, setPublicDetailAction] = useState<PublicActionItemDto | null>(null);

    // 加载动作列表
    useEffect(() => {
        if (!userId) return;

        // 搜索模式下不加载普通列表
        if (searchTerm) return;

        loadActions();
    }, [userId, currentPage]);

    // 加载公共动作列表
    useEffect(() => {
        if (!userId) return;
        loadPublicActions();
    }, [userId, publicCurrentPage]);

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

    const loadPublicActions = async (opts?: { page?: number; search?: string }) => {
        if (!userId) return;
        setPublicLoading(true);
        try {
            const searchVal = opts?.search ?? publicSearchTerm;
            const pageVal = opts?.page ?? publicCurrentPage;
            const res = await publicActionLibService.listActions({
                page: pageVal,
                limit: itemsPerPage,
                search: searchVal ? searchVal : undefined,
            });
            if (res) {
                setPublicActions(res.actions || []);
                setPublicTotalRecords(res.totalCount || 0);
            }
        } catch (e: any) {
            console.error('加载公共动作列表失败:', e);
            showToast({ severity: 'error', summary: '加载失败', detail: e?.message || '无法加载公共动作库' });
        } finally {
            setPublicLoading(false);
        }
    };

    const handleAddAction = () => {
        setEditingAction(null);
        setDialogVisible(true);
    };

    const handlePublishMyAction = async (action: StudentActionRow) => {
        try {
            await publicActionLibService.publishFromMyAction({
                actionType: "student",
                actionId: action.id,
            });
            showToast({ severity: 'success', summary: '贡献成功', detail: '已发布到公共动作库' });
            // 刷新公共库列表（如果用户正好在公共库 tab 浏览）
            loadPublicActions();
        } catch (e: any) {
            showToast({ severity: 'error', summary: '贡献失败', detail: e?.message || '请稍后再试' });
        }
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
        } catch (error: any) {
            console.error('删除动作失败:', error);
            showToast({
                severity: 'error',
                summary: '删除失败',
                detail: error?.message || '无法删除动作',
            });
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
                    type: actionData.type,
                    item_schema: actionData.item_schema ?? null,
                    suggested_time: actionData.suggested_time ?? null,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute,
                    includesBodyWeight: actionData.includesBodyWeight,
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
                    type: actionData.type,
                    item_schema: actionData.item_schema ?? null,
                    suggested_time: actionData.suggested_time ?? null,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute,
                    includesBodyWeight: actionData.includesBodyWeight,
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

    const handlePublicSearch = async () => {
        if (!userId) return;
        setPublicSearching(true);
        try {
            setPublicCurrentPage(1);
            await loadPublicActions({ page: 1, search: publicSearchTerm });
        } finally {
            setPublicSearching(false);
        }
    };

    const handleAddPublicToMyLib = async (actionId: string) => {
        try {
            await publicActionLibService.addToMyLib({ actionId });
            showToast({ severity: 'success', summary: '已加入', detail: '已添加到我的动作库' });
            // 刷新：我的动作库 + 公共动作库的 isAdded
            if (searchTerm) {
                handleSearch();
            } else {
                loadActions();
            }
            loadPublicActions();
        } catch (e: any) {
            showToast({ severity: 'error', summary: '加入失败', detail: e?.message || '无法加入动作' });
        }
    };

    const handleTogglePublicLike = async (actionId: string) => {
        try {
            const res = await publicActionLibService.toggleLike({ actionId });
            setPublicActions((prev) =>
                prev.map((a) =>
                    a.id === actionId
                        ? {
                            ...a,
                            isLiked: res.liked,
                            like_count: res.likeCount,
                        }
                        : a,
                ),
            );
        } catch (e: any) {
            showToast({ severity: 'error', summary: '操作失败', detail: e?.message || '点赞操作失败' });
        }
    };

    const renderActionCard = (action: StudentActionRow) => {
        const positions = action.positions || [];
        const itemType = action.type || 'STRENGTH';
        const typeMeta = {
            STRENGTH: { label: '力量', icon: 'pi pi-sliders-h', className: 'bg-orange-50 text-orange-600' },
            DIET: { label: '饮食', icon: 'pi pi-apple', className: 'bg-green-50 text-green-600' },
            CARDIO: { label: '有氧', icon: 'pi pi-bolt', className: 'bg-blue-50 text-blue-600' },
            HABIT: { label: '习惯', icon: 'pi pi-heart', className: 'bg-purple-50 text-purple-600' },
        } as const;
        const meta = typeMeta[itemType];

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
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${meta.className}`}>
                                <i className={`${meta.icon} text-xs mr-1`} />
                                {meta.label}
                            </span>
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
                            icon="pi pi-cloud-upload"
                            className="p-button-rounded p-button-text"
                            tooltip="贡献到公共动作库"
                            onClick={() => handlePublishMyAction(action)}
                        />
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

    const renderPublicActionCard = (action: PublicActionItemDto) => {
        const itemType = action.type || 'STRENGTH';
        const typeMeta = {
            STRENGTH: { label: '力量', icon: 'pi pi-sliders-h', className: 'bg-orange-50 text-orange-600' },
            DIET: { label: '饮食', icon: 'pi pi-apple', className: 'bg-green-50 text-green-600' },
            CARDIO: { label: '有氧', icon: 'pi pi-bolt', className: 'bg-blue-50 text-blue-600' },
            HABIT: { label: '习惯', icon: 'pi pi-heart', className: 'bg-purple-50 text-purple-600' },
        } as const;
        const meta = (typeMeta as any)[itemType] || typeMeta.STRENGTH;

        const contributorName = action.contributor?.nickname || '贡献者';

        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:shadow-sm transition-all mb-2">
                <div className="flex justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold text-900 mb-1 line-clamp-1">
                                {action.name}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    icon={action.isLiked ? 'pi pi-heart-fill' : 'pi pi-heart'}
                                    className={`p-button-rounded p-button-text ${action.isLiked ? 'text-red-500' : ''}`}
                                    tooltip={action.isLiked ? '取消点赞' : '点赞'}
                                    onClick={() => handleTogglePublicLike(action.id)}
                                />
                                <span className="text-sm text-surface-600 font-semibold min-w-[2ch] text-right">
                                    {action.like_count || 0}
                                </span>
                            </div>
                        </div>

                        <p className="text-600 text-sm mb-3 line-clamp-2">
                            {action.detail || '暂无描述'}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${meta.className}`}>
                                <i className={`${meta.icon} text-xs mr-1`} />
                                {meta.label}
                            </span>
                            {(action.positions || []).slice(0, 3).map((pos, idx) => (
                                <span
                                    key={idx}
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
                        </div>

                        <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                {action.contributor?.avatarUrl ? (
                                    <img
                                        src={action.contributor.avatarUrl}
                                        alt={contributorName}
                                        className="w-5 h-5 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-surface-200 text-surface-600 flex items-center justify-center text-[10px] font-bold">
                                        {contributorName.charAt(0)}
                                    </div>
                                )}
                                <span className="font-medium">贡献者：{contributorName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    label="详情"
                                    icon="pi pi-eye"
                                    className="p-button-outlined"
                                    onClick={() => {
                                        setPublicDetailAction(action);
                                        setPublicDetailVisible(true);
                                    }}
                                />
                                <Button
                                    label={action.isAdded ? '已加入' : '加入我的动作库'}
                                    icon={action.isAdded ? 'pi pi-check' : 'pi pi-plus'}
                                    className={action.isAdded ? 'p-button-outlined' : ''}
                                    disabled={action.isAdded}
                                    onClick={() => handleAddPublicToMyLib(action.id)}
                                />
                            </div>
                        </div>
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
            <PublicActionDetailDialog
                visible={publicDetailVisible}
                action={publicDetailAction}
                onHide={() => setPublicDetailVisible(false)}
            />
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
                <TabView>
                    <TabPanel header="我的动作库">
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
                                                const newPage = (e.first / e.rows) + 1;
                                                setCurrentPage(newPage);
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </TabPanel>

                    <TabPanel header="公共动作库">
                        <div className="border-b border-surface-200 p-4 md:p-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-900">公共动作库</h2>
                                    <p className="text-600 mt-1">发现好用动作，一键加入你的动作库</p>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mt-6">
                                <div className="flex-1">
                                    <IconField iconPosition="left" className='w-full'>
                                        <InputIcon className="pi pi-search"> </InputIcon>
                                        <InputText
                                            value={publicSearchTerm}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setPublicSearchTerm(value);
                                                if (!value) {
                                                    setPublicCurrentPage(1);
                                                    loadPublicActions({ page: 1, search: '' });
                                                }
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && handlePublicSearch()}
                                            placeholder="搜索公共动作名称或描述..."
                                            className="w-full"
                                        />
                                    </IconField>
                                </div>
                                <Button
                                    label="搜索"
                                    icon="pi pi-search"
                                    onClick={handlePublicSearch}
                                    loading={publicSearching}
                                />
                            </div>
                        </div>

                        <div className="p-4 md:p-6">
                            {publicLoading ? (
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
                            ) : publicActions.length === 0 ? (
                                <div className="text-center py-12">
                                    <h3 className="text-lg font-semibold text-900 mb-2">暂无公共动作</h3>
                                    <p className="text-600 mb-6">先在“我的动作库”创建动作，再点击“贡献到公共动作库”按钮发布</p>
                                </div>
                            ) : (
                                <>
                                    <DataView
                                        value={publicActions}
                                        itemTemplate={renderPublicActionCard}
                                        emptyMessage="未找到匹配的公共动作"
                                    />
                                    <div className="mt-4">
                                        <Paginator
                                            first={(publicCurrentPage - 1) * itemsPerPage}
                                            rows={itemsPerPage}
                                            totalRecords={publicTotalRecords}
                                            onPageChange={(e) => {
                                                const newPage = (e.first / e.rows) + 1;
                                                setPublicCurrentPage(newPage);
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </TabPanel>
                </TabView>
            </Card>
        </div>
    );
};

export default StudentActionLib;
