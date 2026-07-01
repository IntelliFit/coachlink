'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
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
import FormattedActionText from '@/components/shared/FormattedActionText';

const StudentActionLib = () => {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const searchParams = useSearchParams();
    
    // 根据查询参数设置默认标签页：tab=public 时显示公共动作库（索引1），否则显示我的动作库（索引0）
    const [activeTabIndex, setActiveTabIndex] = useState(() => {
        const tab = searchParams.get('tab');
        return tab === 'public' ? 1 : 0;
    });

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
    const [pendingEditsVisible, setPendingEditsVisible] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<{ actionId: string; name: string; pendingCount: number }[]>([]);
    const [selectedPublicPreset, setSelectedPublicPreset] = useState<'all' | 'recommended' | 'fat-loss' | 'upper-body' | 'core-back'>('all');
    const [publicOnlyWithDemo, setPublicOnlyWithDemo] = useState(false);

    const PUBLIC_PRESET_SEARCH_MAP: Record<'fat-loss' | 'upper-body' | 'core-back', string> = {
        'fat-loss': '有氧',
        'upper-body': '上肢',
        'core-back': '核心',
    };

    useEffect(() => {
        if (!userId) return;
        publicActionLibService.pendingEditsSummary()
            .then((res) => {
                if (res.totalPending > 0) {
                    setPendingEdits(res.actions || []);
                    setPendingEditsVisible(true);
                }
            })
            .catch(() => {
                // ignore notification fetch errors
            });
    }, [userId]);

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
        const missingDemo = !action.url || !action.url.trim();
        const missingParts: string[] = [];
        if (missingDemo) missingParts.push('演示视频');

        if (missingParts.length > 0) {
            confirmDialog({
                header: '贡献提示',
                message: (
                    <div className="flex flex-col gap-2 text-sm text-surface-700">
                        <div>为保证公共动作库质量，以下信息必须完善后才能贡献：</div>
                        <div className="text-orange-600">{missingParts.join('、')}</div>
                        <div className="text-surface-600">
                        排序规则概览：视频演示权重最高，其次是点赞、属性/部位丰富度、贡献者影响力。
                        </div>
                    </div>
                ),
                acceptLabel: '去完善',
                accept: () => {},
            });
            return;
        }

        confirmDialog({
            header: '确认贡献',
            message: (
                <div className="flex flex-col gap-2 text-sm text-surface-700">
                    <div>感谢贡献！演示视频为必填，描述可选但建议补充。</div>
                    <div className="text-surface-600">
                        排序规则概览：视频演示权重最高，其次是点赞、属性/部位丰富度、贡献者影响力。
                    </div>
                </div>
            ),
            acceptLabel: '继续贡献',
            rejectLabel: '再检查一下',
            accept: async () => {
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
            },
        });
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
                    reference_1rm: actionData.reference_1rm ?? null,
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
                    reference_1rm: actionData.reference_1rm ?? null,
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
            setSelectedPublicPreset('all');
            setPublicCurrentPage(1);
            await loadPublicActions({ page: 1, search: publicSearchTerm });
        } finally {
            setPublicSearching(false);
        }
    };

    const handleSelectPublicPreset = async (
        preset: 'all' | 'recommended' | 'fat-loss' | 'upper-body' | 'core-back',
    ) => {
        if (!userId) return;

        setPublicSearching(true);
        try {
            setSelectedPublicPreset(preset);
            setPublicCurrentPage(1);

            if (preset === 'all' || preset === 'recommended') {
                setPublicSearchTerm('');
                await loadPublicActions({ page: 1, search: '' });
                return;
            }

            const keyword = PUBLIC_PRESET_SEARCH_MAP[preset];
            setPublicSearchTerm(keyword);
            await loadPublicActions({ page: 1, search: keyword });
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
                        <FormattedActionText
                            text={action.detail}
                            className="text-600 text-sm mb-3"
                            lineClampClassName="line-clamp-2"
                        />

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
            <div className="border border-surface-200 rounded-lg p-3 hover:shadow-sm transition-all mb-1.5">
                <div className="flex justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-900 mb-0.5 line-clamp-1">
                                {action.name}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    icon={action.isLiked ? 'pi pi-heart-fill' : 'pi pi-heart'}
                                    className={`p-button-rounded p-button-text w-8 h-8 ${action.isLiked ? 'text-red-500' : ''}`}
                                    tooltip={action.isLiked ? '取消点赞' : '点赞'}
                                    onClick={() => handleTogglePublicLike(action.id)}
                                />
                                <span className="text-xs text-surface-600 font-semibold min-w-[2ch] text-right">
                                    {action.like_count || 0}
                                </span>
                            </div>
                        </div>

                        <FormattedActionText
                            text={action.detail}
                            className="text-600 text-xs mb-2"
                            lineClampClassName="line-clamp-1"
                        />

                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {action.url ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    包含演示
                                </span>
                            ) : (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-600">
                                    无演示视频
                                </span>
                            )}
                            {action.detail && action.detail.trim().length > 0 ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    有描述
                                </span>
                            ) : (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-600">
                                    无描述
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${meta.className}`}>
                                <i className={`${meta.icon} text-[10px] mr-1`} />
                                {meta.label}
                            </span>
                            {(action.positions || []).slice(0, 3).map((pos, idx) => (
                                <span
                                    key={idx}
                                    className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-700"
                                >
                                    {pos}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-surface-600">
                                {action.contributor?.avatarUrl ? (
                                    <img
                                        src={action.contributor.avatarUrl}
                                        alt={contributorName}
                                        className="w-4 h-4 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-4 h-4 rounded-full bg-surface-200 text-surface-600 flex items-center justify-center text-[9px] font-bold">
                                        {contributorName.charAt(0)}
                                    </div>
                                )}
                                <span className="font-medium">贡献者：{contributorName}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    label="详情"
                                    icon="pi pi-eye"
                                    size="small"
                                    className="p-button-outlined px-2 py-1 text-xs"
                                    onClick={() => {
                                        setPublicDetailAction(action);
                                        setPublicDetailVisible(true);
                                    }}
                                />
                                <Button
                                    label={action.isAdded ? '已加入' : '加入我的动作库'}
                                    icon={action.isAdded ? 'pi pi-check' : 'pi pi-plus'}
                                    size="small"
                                    className={action.isAdded ? 'p-button-outlined px-2 py-1 text-xs' : 'px-2 py-1 text-xs'}
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

    const displayedPublicActions = useMemo(() => {
        let next = [...publicActions];

        if (selectedPublicPreset === 'recommended') {
            const calcScore = (item: PublicActionItemDto) => {
                const hasVideoScore = item.url ? 30 : 0;
                const hasDetailScore = item.detail && item.detail.trim().length > 0 ? 15 : 0;
                const likesScore = Math.min(item.like_count || 0, 20);
                const hasPositionsScore = (item.positions?.length || 0) > 0 ? 10 : 0;
                return hasVideoScore + hasDetailScore + likesScore + hasPositionsScore;
            };
            next.sort((a, b) => calcScore(b) - calcScore(a));
        }

        if (publicOnlyWithDemo) {
            next = next.filter((item) => !!item.url);
        }

        return next;
    }, [publicActions, selectedPublicPreset, publicOnlyWithDemo]);

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
            <Dialog
                header="有待审核的编辑建议"
                visible={pendingEditsVisible}
                modal
                draggable={false}
                resizable={false}
                dismissableMask
                style={{ width: '520px', maxWidth: '95vw' }}
                onHide={() => setPendingEditsVisible(false)}
                className="p-fluid"
            >
                {pendingEdits.length === 0 ? (
                    <div className="text-sm text-surface-600">暂无待审核内容</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="text-sm text-surface-700">
                            你有 {pendingEdits.reduce((sum, i) => sum + i.pendingCount, 0)} 条编辑建议待处理。
                        </div>
                        <div className="flex flex-col gap-2">
                            {pendingEdits.map((item) => (
                                <button
                                    key={item.actionId}
                                    className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-sm hover:bg-surface-50 text-left"
                                    onClick={async () => {
                                        try {
                                            const res = await publicActionLibService.getAction({
                                                actionId: item.actionId,
                                                viewerActionType: "student",
                                            });
                                            setPublicDetailAction(res.action);
                                            setPublicDetailVisible(true);
                                            setPendingEditsVisible(false);
                                        } catch {
                                            // ignore
                                        }
                                    }}
                                >
                                    <span className="text-surface-800">{item.name}</span>
                                    <span className="text-surface-500">待审核 {item.pendingCount}</span>
                                </button>
                            ))}
                        </div>
                        <div className="text-xs text-surface-500">
                            打开对应动作详情可查看自动通过后的编辑记录。
                        </div>
                    </div>
                )}
            </Dialog>
            <PublicActionDetailDialog
                visible={publicDetailVisible}
                action={publicDetailAction}
                onHide={() => setPublicDetailVisible(false)}
                viewerActionType="student"
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
                <TabView activeIndex={activeTabIndex} onTabChange={(e) => setActiveTabIndex(e.index)}>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                                        {getCurrentData().map((action) => (
                                            <div key={action.id} className="h-full">
                                                {renderActionCard(action)}
                                            </div>
                                        ))}
                                    </div>
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
                                    <p className="text-600 mt-1">新手先点「新手推荐」，不知道选啥也能直接开始</p>
                                </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm text-surface-700">
                                公共动作库由社区共建。所有人都可以提交修改建议，提交后会直接更新并保留编辑记录。
                                我们希望集中优质资源与训练生态，欢迎完善演示视频与描述信息。
                            </div>

                            <div className="mt-4">
                                <div className="text-sm text-surface-700 mb-2">小白快捷入口</div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        label="全部"
                                        outlined={selectedPublicPreset !== 'all'}
                                        onClick={() => handleSelectPublicPreset('all')}
                                        className="h-9"
                                    />
                                    <Button
                                        label="新手推荐（不知道选啥）"
                                        outlined={selectedPublicPreset !== 'recommended'}
                                        onClick={() => handleSelectPublicPreset('recommended')}
                                        className="h-9"
                                    />
                                    <Button
                                        label="减脂有氧"
                                        outlined={selectedPublicPreset !== 'fat-loss'}
                                        onClick={() => handleSelectPublicPreset('fat-loss')}
                                        className="h-9"
                                    />
                                    <Button
                                        label="胸肩手臂"
                                        outlined={selectedPublicPreset !== 'upper-body'}
                                        onClick={() => handleSelectPublicPreset('upper-body')}
                                        className="h-9"
                                    />
                                    <Button
                                        label="腰背核心"
                                        outlined={selectedPublicPreset !== 'core-back'}
                                        onClick={() => handleSelectPublicPreset('core-back')}
                                        className="h-9"
                                    />
                                    <Button
                                        label={publicOnlyWithDemo ? '仅看有演示: 开' : '仅看有演示: 关'}
                                        outlined={!publicOnlyWithDemo}
                                        onClick={() => setPublicOnlyWithDemo((prev) => !prev)}
                                        className="h-9"
                                    />
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
                            ) : displayedPublicActions.length === 0 ? (
                                <div className="text-center py-12">
                                    <h3 className="text-lg font-semibold text-900 mb-2">暂无公共动作</h3>
                                    <p className="text-600 mb-6">
                                        {publicOnlyWithDemo
                                            ? '当前筛选下没有包含演示视频的动作，先关闭“仅看有演示”试试'
                                            : '先在“我的动作库”创建动作，再点击“贡献到公共动作库”按钮发布'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-3">
                                        {displayedPublicActions.map((action) => (
                                            <div key={action.id} className="h-full">
                                                {renderPublicActionCard(action)}
                                            </div>
                                        ))}
                                    </div>
                                    {!publicOnlyWithDemo && (
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
                                    )}
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
