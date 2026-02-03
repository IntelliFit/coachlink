'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { actionLibService } from '@/app/service/actionLibService';
import { publicActionLibService } from '@/app/service/publicActionLibService';
import ActionEditDialog from './ActionEditDialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { CoachActionRow } from '@/types';
import ActionCard from './ActionCard';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import MergeActionsDialog from './MergeActionsDialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { Paginator } from 'primereact/paginator';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';
import PublicActionDetailDialog from '@/components/action-lib/PublicActionDetailDialog';

const ActionLib = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const { showToast } = useToastContext();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [searchResults, setSearchResults] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('pageId') || '1'));
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchTotalRecords, setSearchTotalRecords] = useState(0);
    const [editingAction, setEditingAction] = useState<CoachActionRow | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedActions, setSelectedActions] = useState<CoachActionRow[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [mergeDialogVisible, setMergeDialogVisible] = useState(false);

    const itemsPerPage = 12;

    // 公共动作库（教练端）
    const [publicActions, setPublicActions] = useState<PublicActionItemDto[]>([]);
    const [publicLoading, setPublicLoading] = useState(false);
    const [publicSearching, setPublicSearching] = useState(false);
    const [publicSearchTerm, setPublicSearchTerm] = useState('');
    const [publicCurrentPage, setPublicCurrentPage] = useState(1);
    const [publicTotalRecords, setPublicTotalRecords] = useState(0);
    const [publicDetailVisible, setPublicDetailVisible] = useState(false);
    const [publicDetailAction, setPublicDetailAction] = useState<PublicActionItemDto | null>(null);

    // 逻辑：加载列表
    useEffect(() => {
        if (!coach?.id || searchTerm) return;
        loadActions();
    }, [coach?.id, currentPage]);

    useEffect(() => {
        if (!coach?.id) return;
        loadPublicActions();
    }, [coach?.id, publicCurrentPage]);

    const loadActions = async () => {

        setLoading(true);
        try {
            const res = await actionLibService.listActions({
                page: currentPage,
                limit: itemsPerPage
            });
            if (res) {
                setActions(res.actions);
                setTotalRecords(res.totalCount);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作列表' });
        } finally {
            setLoading(false);
        }
    };

    const loadPublicActions = async (opts?: { page?: number; search?: string }) => {
        if (!coach?.id) return;
        setPublicLoading(true);
        try {
            const pageVal = opts?.page ?? publicCurrentPage;
            const searchVal = opts?.search ?? publicSearchTerm;
            const res = await publicActionLibService.listActions({
                page: pageVal,
                limit: itemsPerPage,
                search: searchVal ? searchVal : undefined,
                viewerActionType: 'coach',
            });
            if (res) {
                setPublicActions(res.actions || []);
                setPublicTotalRecords(res.totalCount || 0);
            }
        } finally {
            setPublicLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!coach?.id) return;
        setSearching(true);
        try {
            const res = await actionLibService.listActions({
                search: searchTerm || undefined,
                page: 1,
                limit: itemsPerPage
            });
            if (res) {
                setSearchResults(res.actions);
                setSearchTotalRecords(res.totalCount);
                setCurrentPage(1);
                setSelectedActions([]);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '搜索失败', detail: '无法搜索动作' });
        } finally {
            setSearching(false);
        }
    };

    const handleSaveAction = async (actionData: Partial<CoachActionRow>) => {
        try {
            if (editingAction) {
                await actionLibService.updateAction({ id: editingAction.id, ...actionData });
                showToast({ severity: 'success', summary: '更新成功', detail: '动作已更新' });
            } else {
                if (!coach?.id) return;
                await actionLibService.addAction({
                    name: actionData.name || '',
                    detail: actionData.detail || '',
                    url: actionData.url || '',
                    positions: actionData.positions || [],
                    attrs: actionData.attrs || [],
                    type: actionData.type,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute || false,
                    includesBodyWeight: actionData.includesBodyWeight || false,
                    item_schema: actionData.item_schema,
                    suggested_time: actionData.suggested_time,
                });
                showToast({ severity: 'success', summary: '添加成功', detail: '新动作已添加' });
            }
            setDialogVisible(false);
            searchTerm ? handleSearch() : loadActions();
        } catch (error) {
            const message = error instanceof Error ? error.message : '无法保存动作';
            showToast({ severity: 'error', summary: '保存失败', detail: message });
        }
    };

    const handleEditAction = (action: CoachActionRow) => {
        setEditingAction(action);
        setDialogVisible(true);
    };

    const handleDeleteAction = (action: CoachActionRow) => {
        confirmDialog({
            message: `确定要删除动作"${action.name}"吗？此操作无法撤销。`,
            header: '确认删除',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await actionLibService.deleteAction({ id: action.id });
                    showToast({ severity: 'success', summary: '删除成功', detail: '动作已删除' });
                    setSelectedActions(prev => prev.filter(a => a.id !== action.id));
                    searchTerm ? handleSearch() : loadActions();
                } catch (error: any) {
                    showToast({
                        severity: 'error',
                        summary: '删除失败',
                        detail: error?.message || '无法删除动作',
                    });
                }
            }
        });
    };

    const handleToggleSelect = (action: CoachActionRow, checked: boolean) => {
        setSelectedActions(prev => {
            const exists = prev.some(a => a.id === action.id);
            if (checked) return exists ? prev : [...prev, action];
            return prev.filter(a => a.id !== action.id);
        });
    };

    const handleSelectAllOnPage = () => {
        const current = (searchTerm ? searchResults : actions) || [];
        setSelectedActions(prev => {
            const map = new Map(prev.map(a => [a.id, a]));
            current.forEach(a => map.set(a.id, a));
            return Array.from(map.values());
        });
    };

    const handleClearSelection = () => setSelectedActions([]);

    const handleBulkDelete = () => {
        const ids = selectedActions.map(a => a.id);
        if (ids.length === 0) return;
        confirmDialog({
            header: '批量删除确认',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            message: `确定要批量删除已选择的 ${ids.length} 个动作吗？此操作无法撤销。`,
            accept: async () => {
                setBulkDeleting(true);
                try {
                    const results = await Promise.allSettled(
                        selectedActions.map(a => actionLibService.deleteAction({ id: a.id }))
                    );
                    const ok = results.filter(r => r.status === 'fulfilled').length;
                    const fail = results.length - ok;
                    if (fail === 0) {
                        showToast({ severity: 'success', summary: '批量删除成功', detail: `已删除 ${ok} 个动作` });
                    } else {
                        showToast({ severity: 'warn', summary: '批量删除部分失败', detail: `成功 ${ok} 个，失败 ${fail} 个` });
                    }
                    setSelectedActions([]);
                    searchTerm ? handleSearch() : loadActions();
                } catch (e: any) {
                    showToast({ severity: 'error', summary: '批量删除失败', detail: e?.message || '请稍后重试' });
                } finally {
                    setBulkDeleting(false);
                }
            }
        });
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        // const params = new URLSearchParams(searchParams.toString())
        // params.set('page', newPage.toString());
        // router.push(pathname + '?' + params.toString());

        setCurrentPage(newPage);
        setSelectedActions([]);
    };

    const handlePublishMyAction = async (action: CoachActionRow) => {
        try {
            await publicActionLibService.publishFromMyAction({
                actionType: "coach",
                actionId: action.id,
            });
            showToast({ severity: 'success', summary: '贡献成功', detail: '已发布到公共动作库' });
        } catch (e: any) {
            showToast({ severity: 'error', summary: '贡献失败', detail: e?.message || '请稍后再试' });
        }
    };

    const handlePublicSearch = async () => {
        if (!coach?.id) return;
        setPublicSearching(true);
        try {
            setPublicCurrentPage(1);
            await loadPublicActions({ page: 1, search: publicSearchTerm });
        } finally {
            setPublicSearching(false);
        }
    };

    const handleAddPublicToCoachLib = async (actionId: string) => {
        try {
            await publicActionLibService.addToMyLib({ actionId, targetActionType: 'coach' });
            showToast({ severity: 'success', summary: '已加入', detail: '已添加到教练动作库' });
            loadPublicActions();
            searchTerm ? handleSearch() : loadActions();
        } catch (e: any) {
            showToast({ severity: 'error', summary: '加入失败', detail: e?.message || '请稍后再试' });
        }
    };

    const handleTogglePublicLike = async (actionId: string) => {
        try {
            const res = await publicActionLibService.toggleLike({ actionId });
            setPublicActions((prev) =>
                prev.map((a) => (a.id === actionId ? { ...a, isLiked: res.liked, like_count: res.likeCount } : a)),
            );
        } catch (e: any) {
            showToast({ severity: 'error', summary: '操作失败', detail: e?.message || '请稍后再试' });
        }
    };

    const renderPublicActionCard = (action: PublicActionItemDto) => {
        const contributorName = action.contributor?.nickname || '贡献者';
        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:shadow-sm transition-all mb-2 bg-white">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
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

                        <div className="flex items-center justify-between mt-3">
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
                                    label={action.isAdded ? '已加入' : '加入教练动作库'}
                                    icon={action.isAdded ? 'pi pi-check' : 'pi pi-plus'}
                                    className={action.isAdded ? 'p-button-outlined' : ''}
                                    disabled={action.isAdded}
                                    onClick={() => handleAddPublicToCoachLib(action.id)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderActionCard = (action: CoachActionRow) => {
        return <ActionCard
            action={action}
            onEditAction={handleEditAction}
            onDeleteAction={handleDeleteAction}
            onPublishAction={handlePublishMyAction}
            selectionEnabled
            selected={selectedActions.some(a => a.id === action.id)}
            onToggleSelect={handleToggleSelect}
        />
    };

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10 animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <ConfirmDialog />
            <PublicActionDetailDialog
                visible={publicDetailVisible}
                action={publicDetailAction}
                onHide={() => setPublicDetailVisible(false)}
            />
            <ActionEditDialog
                visible={dialogVisible}
                action={editingAction}
                onSave={handleSaveAction}
                onCancel={() => setDialogVisible(false)}
            />
            <MergeActionsDialog
                visible={mergeDialogVisible}
                actions={selectedActions}
                onHide={() => setMergeDialogVisible(false)}
                onSuccess={(res) => {
                    showToast({
                        severity: 'success',
                        summary: '合并完成',
                        detail: `已替换 ${res.replacedCount} 处引用（模板 ${res.updatedTemplates} 个，计划实例 ${res.updatedInstances} 个）`,
                    });
                    setSelectedActions([]);
                    searchTerm ? handleSearch() : loadActions();
                }}
            />

            <TabView>
                <TabPanel header="我的动作库">
                    {/* Header */}
                    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-10 px-1 sm:px-2">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-surface-900">动作库管理</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-2 py-0.5 rounded">
                                    {searchTerm ? searchTotalRecords : totalRecords} Actions
                                </span>
                                <span className="text-sm text-surface-500 font-medium">定制您的标准动作教学体系</span>
                            </div>
                        </div>
                        <Button
                            label="添加动作"
                            icon="pi pi-plus"
                            onClick={() => { setEditingAction(null); setDialogVisible(true); }}
                            className="w-full sm:w-auto p-button-primary shadow-lg shadow-primary-100 rounded-2xl px-6 active:scale-95 transition-transform"
                        />
                    </header>

                    {/* Search */}
                    <section className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8 px-1 sm:px-2">
                        <IconField iconPosition="left" className="flex-1">
                            <InputIcon className="pi pi-search text-surface-400" />
                            <InputText
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (!e.target.value) {
                                        setSearchResults([]);
                                        setSearchTotalRecords(0);
                                        setCurrentPage(1);
                                        setSelectedActions([]);
                                        loadActions();
                                    }
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="搜索动作名称、描述或训练部位..."
                                className="w-full border-surface-200 bg-surface-50/50 focus:bg-white focus:border-primary rounded-2xl py-3 transition-all"
                            />
                        </IconField>
                        <Button
                            icon="pi pi-search"
                            label="搜索"
                            onClick={handleSearch}
                            loading={searching}
                            className="w-full sm:w-auto p-button-primary p-button-outlined rounded-2xl px-6 active:scale-95 transition-transform"
                        />
                    </section>

                    <main>
                        {loading || searching ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="flex items-center gap-5 p-4 bg-white border border-surface-100 rounded-[20px]">
                                        <Skeleton width="56px" height="56px" borderRadius="16px" />
                                        <div className="flex-1"><Skeleton width="30%" className="mb-2" /><Skeleton width="60%" height="0.8rem" /></div>
                                        <div className="flex gap-2"><Skeleton shape="circle" size="2rem" /><Skeleton shape="circle" size="2rem" /></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {selectedActions.length > 0 && (
                                    <div className="mb-4 px-1 sm:px-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-2xl border border-surface-200 bg-white">
                                            <div className="text-sm text-surface-700 font-semibold">
                                                已选择 {selectedActions.length} 个动作
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    label="合并/去重"
                                                    icon="pi pi-clone"
                                                    onClick={() => setMergeDialogVisible(true)}
                                                    disabled={bulkDeleting || selectedActions.length < 2}
                                                    className="rounded-xl"
                                                />
                                                <Button
                                                    label="全选本页"
                                                    icon="pi pi-check-square"
                                                    outlined
                                                    onClick={handleSelectAllOnPage}
                                                    disabled={bulkDeleting}
                                                    className="rounded-xl"
                                                />
                                                <Button
                                                    label="清空选择"
                                                    icon="pi pi-times"
                                                    text
                                                    onClick={handleClearSelection}
                                                    disabled={bulkDeleting}
                                                    className="rounded-xl"
                                                />
                                                <Button
                                                    label="批量删除"
                                                    icon="pi pi-trash"
                                                    severity="danger"
                                                    onClick={handleBulkDelete}
                                                    loading={bulkDeleting}
                                                    disabled={bulkDeleting}
                                                    className="rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <DataView
                                    lazy
                                    value={searchTerm ? searchResults : actions}
                                    itemTemplate={renderActionCard}
                                    paginator
                                    rows={itemsPerPage}
                                    totalRecords={searchTerm ? searchTotalRecords : totalRecords}
                                    onPage={onPageChange}
                                    first={(currentPage - 1) * itemsPerPage}
                                    className="bg-transparent"
                                    pt={{
                                        content: { className: 'bg-transparent border-none space-y-1' },
                                        paginator: {
                                            pageButton: ({ context }) => ({
                                                className: context.active
                                                    ? 'bg-primary text-white rounded-xl shadow-md shadow-primary-100'
                                                    : 'text-surface-500 rounded-xl hover:bg-surface-100 transition-colors'
                                            })
                                        }
                                    }}
                                />
                                {(searchTerm ? searchResults : actions).length === 0 && (
                                    <div className="text-center py-24 border-2 border-dashed border-surface-100 rounded-[32px]">
                                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-50 text-surface-400 mb-4">
                                            <i className="pi pi-search text-xl" />
                                        </div>
                                        <h3 className="text-lg font-bold text-surface-900 tracking-tight">未找到相关动作</h3>
                                        <p className="text-surface-500 text-sm mt-1">请尝试更换搜索关键词或添加新动作</p>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </TabPanel>

                <TabPanel header="公共动作库">
                    <div className="border-b border-surface-200 p-4 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-900">公共动作库</h2>
                                <p className="text-600 mt-1">挑选高质量动作，一键加入到你的教练动作库</p>
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
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="border rounded-lg p-4 bg-white">
                                        <Skeleton width="100%" height="1.5rem" className="mb-3" />
                                        <Skeleton width="80%" height="1rem" className="mb-2" />
                                        <Skeleton width="60%" height="1rem" className="mb-4" />
                                    </div>
                                ))}
                            </div>
                        ) : publicActions.length === 0 ? (
                            <div className="text-center py-12">
                                <h3 className="text-lg font-semibold text-900 mb-2">暂无公共动作</h3>
                                <p className="text-600 mb-6">可让学员/教练先贡献一些动作，再在这里挑选加入</p>
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
        </div>
    );
};

export default ActionLib;