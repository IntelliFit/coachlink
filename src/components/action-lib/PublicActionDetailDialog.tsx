'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useSession } from 'next-auth/react';
import { useToastContext } from '@/context/ToastContext';
import { publicActionLibService } from '@/app/service/publicActionLibService';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';
import type { PublicActionEditItemDto } from '@/app/api/public-action-lib/list-edits/entity';
import type { PublicActionContributorItemDto } from '@/app/api/public-action-lib/list-contributors/entity';
import ActionEditDialog from '@/app/dashboard/action-lib/ActionEditDialog';
import StudentActionEditDialog from '@/app/me/action-lib/StudentActionEditDialog';
import FormattedActionText from '@/components/shared/FormattedActionText';
import type { CoachActionRow } from '@/types';
import type { StudentActionRow } from '@/types/student';

function isVideoUrl(url: string) {
    const u = url.toLowerCase();
    return (
        u.endsWith('.mp4') ||
        u.endsWith('.webm') ||
        u.endsWith('.mov') ||
        u.endsWith('.m4v') ||
        u.includes('/videos/')
    );
}

export default function PublicActionDetailDialog(props: {
    visible: boolean;
    action: PublicActionItemDto | null;
    onHide: () => void;
    viewerActionType?: "student" | "coach";
}) {
    const { visible, action, onHide, viewerActionType = "student" } = props;
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const { showToast } = useToastContext();
    const [localAction, setLocalAction] = useState<PublicActionItemDto | null>(action);
    const [contributors, setContributors] = useState<PublicActionContributorItemDto[]>([]);
    const [edits, setEdits] = useState<PublicActionEditItemDto[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [compareVisible, setCompareVisible] = useState(false);
    const [compareEdit, setCompareEdit] = useState<PublicActionEditItemDto | null>(null);
    const [compareMode, setCompareMode] = useState<"inline" | "side">("inline");

    const typeMeta = useMemo(() => {
        const type = localAction?.type || 'STRENGTH';
        const map: Record<string, { label: string; className: string; icon: string }> = {
            STRENGTH: { label: '力量', className: 'bg-orange-50 text-orange-600', icon: 'pi pi-sliders-h' },
            DIET: { label: '饮食', className: 'bg-green-50 text-green-600', icon: 'pi pi-apple' },
            CARDIO: { label: '有氧', className: 'bg-blue-50 text-blue-600', icon: 'pi pi-bolt' },
            HABIT: { label: '习惯', className: 'bg-purple-50 text-purple-600', icon: 'pi pi-heart' },
        };
        return map[type] || map.STRENGTH;
    }, [localAction?.type]);

    const schema = (localAction?.item_schema || {}) as any;

    const isOwner = !!localAction?.owner_user_id && localAction.owner_user_id === userId;

    useEffect(() => {
        setLocalAction(action);
    }, [action]);

    useEffect(() => {
        if (!visible || !action) return;
        setLoadingMeta(true);
        Promise.all([
            publicActionLibService.listContributors({ actionId: action.id }),
            publicActionLibService.listEdits({
                actionId: action.id,
                includePending: true,
            }),
        ])
            .then(([contributorsRes, editsRes]) => {
                setContributors(contributorsRes.contributors || []);
                setEdits(editsRes.edits || []);
            })
            .catch((e) => {
                console.error("[public-action-lib] load detail meta error:", e);
            })
            .finally(() => setLoadingMeta(false));
    }, [visible, action?.id]);

    const refreshEdits = async () => {
        if (!localAction) return;
        const res = await publicActionLibService.listEdits({
            actionId: localAction.id,
            includePending: true,
        });
        setEdits(res.edits || []);
    };

    const handleSubmitEdit = async (
        actionData: Partial<CoachActionRow> | Partial<StudentActionRow>,
    ) => {
        if (!localAction) return;
        try {
            await publicActionLibService.submitEdit({
                actionId: localAction.id,
                name: actionData.name ?? localAction.name,
                detail: actionData.detail ?? localAction.detail ?? null,
                url: actionData.url ?? localAction.url ?? null,
                positions: actionData.positions ?? localAction.positions ?? null,
                attrs: actionData.attrs ?? localAction.attrs ?? null,
                type: actionData.type ?? localAction.type ?? null,
                item_schema: actionData.item_schema ?? localAction.item_schema ?? null,
                suggested_time: actionData.suggested_time ?? localAction.suggested_time ?? null,
                enableAutoWeightCompute:
                    actionData.enableAutoWeightCompute ??
                    localAction.enableAutoWeightCompute ??
                    false,
                includesBodyWeight:
                    actionData.includesBodyWeight ??
                    localAction.includesBodyWeight ??
                    false,
                canonical_action_id:
                    actionData.canonical_action_id ?? localAction.canonical_action_id ?? null,
            });
            showToast({
                severity: 'success',
                summary: '已提交',
                detail: '编辑建议已提交，等待上传者审核',
            });
            setEditVisible(false);
            await refreshEdits();
        } catch (e: any) {
            showToast({
                severity: 'error',
                summary: '提交失败',
                detail: e?.message || '请稍后再试',
            });
        }
    };

    const handleReview = async (editId: string, decision: "approve" | "reject") => {
        if (!localAction) return;
        try {
            const res = await publicActionLibService.reviewEdit({
                actionId: localAction.id,
                editId,
                decision,
            });
            setLocalAction(res.action as PublicActionItemDto);
            showToast({
                severity: 'success',
                summary: decision === "approve" ? '已通过' : '已驳回',
                detail: decision === "approve" ? '公共动作已更新' : '编辑提案已驳回',
            });
            await refreshEdits();
        } catch (e: any) {
            showToast({
                severity: 'error',
                summary: '操作失败',
                detail: e?.message || '请稍后再试',
            });
        }
    };

    const withUndefinedFallback = <T,>(next: T | undefined, current: T): T =>
        next === undefined ? current : next;

    const computeChangedFields = (e: PublicActionEditItemDto) => {
        if (!localAction) return [];
        const proposedAction = buildProposedAction(e);
        const changes: { key: string; label: string }[] = [];
        if (proposedAction.name !== localAction.name) {
            changes.push({ key: "name", label: "名称" });
        }
        if ((proposedAction.detail ?? null) !== (localAction.detail ?? null)) {
            changes.push({ key: "detail", label: "描述" });
        }
        if ((proposedAction.url ?? null) !== (localAction.url ?? null)) {
            changes.push({ key: "url", label: "演示视频" });
        }
        if (JSON.stringify(proposedAction.positions ?? null) !== JSON.stringify(localAction.positions ?? null)) {
            changes.push({ key: "positions", label: "训练部位" });
        }
        if (JSON.stringify(proposedAction.attrs ?? null) !== JSON.stringify(localAction.attrs ?? null)) {
            changes.push({ key: "attrs", label: "动作属性" });
        }
        if ((proposedAction.type ?? null) !== (localAction.type ?? null)) {
            changes.push({ key: "type", label: "类型" });
        }
        if (JSON.stringify(proposedAction.item_schema ?? null) !== JSON.stringify(localAction.item_schema ?? null)) {
            changes.push({ key: "item_schema", label: "详细配置" });
        }
        if ((proposedAction.suggested_time ?? null) !== (localAction.suggested_time ?? null)) {
            changes.push({ key: "suggested_time", label: "推荐时间" });
        }
        if ((proposedAction.enableAutoWeightCompute ?? null) !== (localAction.enableAutoWeightCompute ?? null)) {
            changes.push({ key: "enableAutoWeightCompute", label: "智能重量计算" });
        }
        if ((proposedAction.includesBodyWeight ?? null) !== (localAction.includesBodyWeight ?? null)) {
            changes.push({ key: "includesBodyWeight", label: "包含自重" });
        }
        if ((proposedAction.canonical_action_id ?? null) !== (localAction.canonical_action_id ?? null)) {
            changes.push({ key: "canonical_action_id", label: "标准动作关联" });
        }
        return changes;
    };

    const buildProposedAction = (e: PublicActionEditItemDto): PublicActionItemDto => {
        const base = localAction!;
        return {
            ...base,
            name: (withUndefinedFallback(e.proposed_name as any, base.name) || base.name) as any,
            detail: withUndefinedFallback(e.proposed_detail as any, base.detail ?? null),
            url: withUndefinedFallback(e.proposed_url as any, base.url ?? null),
            positions: withUndefinedFallback(e.proposed_positions as any, base.positions ?? null),
            attrs: withUndefinedFallback(e.proposed_attrs as any, base.attrs ?? null),
            type: withUndefinedFallback(e.proposed_type as any, base.type ?? null),
            item_schema: withUndefinedFallback(e.proposed_item_schema as any, base.item_schema ?? null),
            suggested_time: withUndefinedFallback(
                e.proposed_suggested_time as any,
                base.suggested_time ?? null,
            ),
            enableAutoWeightCompute:
                withUndefinedFallback(
                    e.proposed_enableAutoWeightCompute as any,
                    base.enableAutoWeightCompute ?? null,
                ),
            includesBodyWeight:
                withUndefinedFallback(
                    e.proposed_includesBodyWeight as any,
                    base.includesBodyWeight ?? null,
                ),
            canonical_action_id:
                withUndefinedFallback(
                    e.proposed_canonical_action_id as any,
                    base.canonical_action_id ?? null,
                ),
        };
    };

    const renderFieldPair = (
        label: string,
        current: any,
        proposed: any,
        highlight: boolean,
    ) => {
        return (
            <div className={`flex flex-col gap-2 rounded-lg border ${highlight ? 'border-indigo-200 bg-indigo-50/40' : 'border-surface-200'} p-3`}>
                <div className="text-xs font-semibold text-surface-600">{label}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-surface-50 p-2 whitespace-pre-wrap min-h-[38px]">
                        {formatValueForDisplay(current)}
                    </div>
                    <div className="rounded-md bg-surface-50 p-2 whitespace-pre-wrap min-h-[38px]">
                        {formatValueForDisplay(proposed)}
                    </div>
                </div>
            </div>
        );
    };

    const handleSyncToMyLib = async () => {
        if (!localAction) return;
        try {
            await publicActionLibService.syncToMyLib({
                actionId: localAction.id,
                targetActionType: viewerActionType,
            });
            showToast({
                severity: 'success',
                summary: '同步成功',
                detail: '已同步到本地动作库',
            });
        } catch (e: any) {
            showToast({
                severity: 'error',
                summary: '同步失败',
                detail: e?.message || '请稍后再试',
            });
        }
    };

    return (
        <>
        <Dialog
            header={action ? `动作详情：${action.name}` : '动作详情'}
            visible={visible}
            modal
            draggable={false}
            resizable={false}
            dismissableMask
            style={{ width: '720px', maxWidth: '95vw' }}
            onHide={onHide}
            className="p-fluid"
        >
            {!localAction ? (
                <div className="text-surface-600">暂无数据</div>
            ) : (
                <div className="flex flex-col gap-5">
                    {/* Summary */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${typeMeta.className}`}>
                                    <i className={`${typeMeta.icon} mr-1`} />
                                    {typeMeta.label}
                                </span>
                                <span className="text-xs text-surface-500">
                                    点赞 {localAction.like_count || 0}
                                </span>
                            </div>
                            <FormattedActionText
                                text={localAction.detail}
                                className="mt-2 text-sm text-surface-700 whitespace-pre-wrap"
                            />
                        </div>
                        <div className="text-right shrink-0 text-xs text-surface-500">
                            <div>贡献者：{localAction.contributor?.nickname || '用户'}</div>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">训练部位</div>
                        <div className="flex flex-wrap gap-2">
                            {(localAction.positions || []).length ? (
                                (localAction.positions || []).map((p, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                        {p}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-surface-500">暂无</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">动作属性</div>
                        <div className="flex flex-wrap gap-2">
                            {(localAction.attrs || []).length ? (
                                (localAction.attrs || []).map((a, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                        {a}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-surface-500">暂无</span>
                            )}
                        </div>
                    </div>

                    {/* Type-specific details */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-4">
                        <div className="text-xs font-semibold text-surface-700 mb-2">详细配置</div>
                        {localAction.type === 'STRENGTH' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>智能重量计算：{localAction.enableAutoWeightCompute ? '开启' : '关闭'}</div>
                                <div>包含自重：{localAction.includesBodyWeight ? '是' : '否'}</div>
                            </div>
                        )}
                        {localAction.type === 'DIET' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>热量(kcal)：{schema.calories ?? '—'}</div>
                                <div>推荐时间：{localAction.suggested_time || '—'}</div>
                            </div>
                        )}
                        {localAction.type === 'CARDIO' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>距离(km)：{schema.distance ? (schema.distance / 1000).toFixed(2) : '—'}</div>
                                <div>时长(min)：{schema.duration ? Math.round(schema.duration / 60) : '—'}</div>
                                <div>配速：{schema.pace ?? '—'}</div>
                            </div>
                        )}
                        {localAction.type === 'HABIT' && (
                            <div className="text-sm text-surface-700">
                                目标：{schema.target_duration ?? '—'}
                            </div>
                        )}
                    </div>

                    {/* Video */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">演示视频</div>
                        {!localAction.url ? (
                            <div className="text-sm text-surface-500">暂无</div>
                        ) : isVideoUrl(localAction.url) ? (
                            <video
                                controls
                                src={localAction.url}
                                className="w-full rounded-xl border border-surface-200 bg-black"
                            />
                        ) : (
                            <a
                                href={localAction.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary-600 underline"
                            >
                                打开演示链接
                            </a>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            label="建议修改"
                            icon="pi pi-pencil"
                            className="p-button-outlined"
                            onClick={() => setEditVisible(true)}
                        />
                        {isOwner && (
                            <Button
                                label="同步到我的动作库"
                                icon="pi pi-sync"
                                className="p-button-outlined"
                                onClick={handleSyncToMyLib}
                            />
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">贡献者</div>
                        {loadingMeta ? (
                            <div className="flex items-center gap-2 py-1">
                                <ProgressSpinner style={{ width: '22px', height: '22px' }} strokeWidth="4" />
                            </div>
                        ) : contributors.length === 0 ? (
                            <div className="text-sm text-surface-500">暂无贡献者记录</div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {contributors.map((c) => (
                                    <div
                                        key={c.userId}
                                        className="flex items-center gap-2 rounded-full border border-surface-200 px-2 py-1 text-xs text-surface-700"
                                    >
                                        {c.avatarUrl ? (
                                            <img
                                                src={c.avatarUrl}
                                                alt={c.nickname || '用户'}
                                                className="w-5 h-5 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-surface-200 text-surface-600 flex items-center justify-center text-[10px] font-bold">
                                                {(c.nickname || '用').charAt(0)}
                                            </div>
                                        )}
                                        <span>{c.nickname || '用户'}</span>
                                        <span className="text-surface-500">贡献 {c.contribution_count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">
                            {isOwner ? '待审核/历史编辑' : '历史编辑'}
                        </div>
                        {loadingMeta ? (
                            <div className="flex items-center gap-2 py-1">
                                <ProgressSpinner style={{ width: '22px', height: '22px' }} strokeWidth="4" />
                            </div>
                        ) : edits.length === 0 ? (
                            <div className="text-sm text-surface-500">暂无编辑记录</div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {edits.map((e) => {
                                    const changed = computeChangedFields(e);
                                    return (
                                    <div key={e.id} className="rounded-lg border border-surface-200 p-3">
                                        <div className="flex items-center justify-between text-xs text-surface-600">
                                            <div>
                                                {e.proposer?.nickname || '用户'} 提交
                                            </div>
                                            <div>
                                                {e.status === 'pending'
                                                    ? '待审核'
                                                    : e.status === 'approved'
                                                        ? '已通过'
                                                        : '已驳回'}
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {changed.length === 0 ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-600">
                                                    未检测到差异
                                                </span>
                                            ) : (
                                                changed.map((c) => (
                                                    <span
                                                        key={c.key}
                                                        className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700"
                                                    >
                                                        改了{c.label}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        <FormattedActionText
                                            text={e.proposed_detail}
                                            className="mt-2 text-sm text-surface-700"
                                            lineClampClassName="line-clamp-2"
                                        />
                                        <div className="mt-2">
                                            <Button
                                                label="查看改动"
                                                icon="pi pi-eye"
                                                className="p-button-text"
                                                onClick={() => {
                                                    setCompareEdit(e);
                                                    setCompareVisible(true);
                                                }}
                                            />
                                        </div>
                                        {isOwner && e.status === 'pending' && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <Button
                                                    label="通过"
                                                    icon="pi pi-check"
                                                    onClick={() => handleReview(e.id, "approve")}
                                                />
                                                <Button
                                                    label="驳回"
                                                    icon="pi pi-times"
                                                    className="p-button-outlined"
                                                    onClick={() => handleReview(e.id, "reject")}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            </Dialog>

            {viewerActionType === "coach" ? (
                <ActionEditDialog
                    visible={editVisible}
                    action={buildCoachAction(localAction)}
                    onSave={handleSubmitEdit}
                    onCancel={() => setEditVisible(false)}
                />
            ) : (
                <StudentActionEditDialog
                    visible={editVisible}
                    action={buildStudentAction(localAction)}
                    onSave={handleSubmitEdit}
                    onCancel={() => setEditVisible(false)}
                />
            )}

            <Dialog
                header="改动对比"
                visible={compareVisible}
                modal
                draggable={false}
                resizable={false}
                dismissableMask
                style={{ width: '920px', maxWidth: '95vw' }}
                onHide={() => {
                    setCompareVisible(false);
                    setCompareEdit(null);
                }}
                className="p-fluid"
            >
                {!localAction || !compareEdit ? (
                    <div className="text-sm text-surface-600">暂无数据</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-surface-700">
                                {compareEdit.proposer?.nickname || '用户'} 的修改建议
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    label="行内"
                                    className={compareMode === "inline" ? "" : "p-button-outlined"}
                                    onClick={() => setCompareMode("inline")}
                                />
                                <Button
                                    label="左右对比"
                                    className={compareMode === "side" ? "" : "p-button-outlined"}
                                    onClick={() => setCompareMode("side")}
                                />
                            </div>
                        </div>

                        {compareMode === "side" ? (
                            <div className="flex flex-col gap-3">
                                {renderFieldPair(
                                    "名称",
                                    localAction.name,
                                    buildProposedAction(compareEdit).name,
                                    (buildProposedAction(compareEdit).name !== localAction.name),
                                )}
                                {renderFieldPair(
                                    "描述",
                                    localAction.detail,
                                    buildProposedAction(compareEdit).detail,
                                    (buildProposedAction(compareEdit).detail !== localAction.detail),
                                )}
                                {renderFieldPair(
                                    "演示视频",
                                    localAction.url,
                                    buildProposedAction(compareEdit).url,
                                    (buildProposedAction(compareEdit).url !== localAction.url),
                                )}
                                {renderFieldPair(
                                    "训练部位",
                                    localAction.positions,
                                    buildProposedAction(compareEdit).positions,
                                    JSON.stringify(localAction.positions) !== JSON.stringify(buildProposedAction(compareEdit).positions),
                                )}
                                {renderFieldPair(
                                    "动作属性",
                                    localAction.attrs,
                                    buildProposedAction(compareEdit).attrs,
                                    JSON.stringify(localAction.attrs) !== JSON.stringify(buildProposedAction(compareEdit).attrs),
                                )}
                                {renderFieldPair(
                                    "类型",
                                    localAction.type,
                                    buildProposedAction(compareEdit).type,
                                    (buildProposedAction(compareEdit).type !== localAction.type),
                                )}
                                {renderFieldPair(
                                    "推荐时间",
                                    localAction.suggested_time,
                                    buildProposedAction(compareEdit).suggested_time,
                                    (buildProposedAction(compareEdit).suggested_time !== localAction.suggested_time),
                                )}
                                {renderFieldPair(
                                    "智能重量计算",
                                    localAction.enableAutoWeightCompute,
                                    buildProposedAction(compareEdit).enableAutoWeightCompute,
                                    (buildProposedAction(compareEdit).enableAutoWeightCompute !== localAction.enableAutoWeightCompute),
                                )}
                                {renderFieldPair(
                                    "包含自重",
                                    localAction.includesBodyWeight,
                                    buildProposedAction(compareEdit).includesBodyWeight,
                                    (buildProposedAction(compareEdit).includesBodyWeight !== localAction.includesBodyWeight),
                                )}
                                {renderFieldPair(
                                    "标准动作关联",
                                    localAction.canonical_action_id,
                                    buildProposedAction(compareEdit).canonical_action_id,
                                    (buildProposedAction(compareEdit).canonical_action_id !== localAction.canonical_action_id),
                                )}
                                {renderFieldPair(
                                    "详细配置 (item_schema)",
                                    localAction.item_schema,
                                    buildProposedAction(compareEdit).item_schema,
                                    JSON.stringify(localAction.item_schema) !== JSON.stringify(buildProposedAction(compareEdit).item_schema),
                                )}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-surface-200 p-3">
                                <div className="text-xs font-semibold text-surface-600 mb-2">改动字段</div>
                                <div className="flex flex-col gap-3 text-sm text-surface-700">
                                    {computeChangedFields(compareEdit).map((c) => (
                                        <div key={c.key}>
                                            <div className="text-xs font-semibold text-surface-600 mb-1">{c.label}</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div className="rounded-md bg-surface-50 p-2 text-xs whitespace-pre-wrap">
                                                    {String((localAction as any)[c.key] ?? '—')}
                                                </div>
                                                <div className="rounded-md bg-indigo-50 p-2 text-xs whitespace-pre-wrap">
                                                    {String((buildProposedAction(compareEdit) as any)[c.key] ?? '—')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>
        </>
    );
}

function formatValueForDisplay(v: any) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "是" : "否";
    if (Array.isArray(v)) return v.length ? v.join("，") : "—";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
}

function buildCoachAction(action: PublicActionItemDto | null) {
    if (!action) return null;
    return {
        id: action.id,
        name: action.name,
        detail: action.detail ?? undefined,
        url: action.url ?? undefined,
        positions: action.positions ?? undefined,
        attrs: action.attrs ?? undefined,
        type: action.type ?? undefined,
        item_schema: action.item_schema ?? undefined,
        suggested_time: action.suggested_time ?? undefined,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? undefined,
        includesBodyWeight: action.includesBodyWeight ?? undefined,
        canonical_action_id: action.canonical_action_id ?? undefined,
    } as CoachActionRow;
}

function buildStudentAction(action: PublicActionItemDto | null) {
    if (!action) return null;
    return {
        id: action.id,
        name: action.name,
        detail: action.detail ?? undefined,
        url: action.url ?? undefined,
        positions: action.positions ?? undefined,
        attrs: action.attrs ?? undefined,
        type: action.type ?? undefined,
        item_schema: action.item_schema ?? undefined,
        suggested_time: action.suggested_time ?? undefined,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? undefined,
        includesBodyWeight: action.includesBodyWeight ?? undefined,
        canonical_action_id: action.canonical_action_id ?? undefined,
    } as StudentActionRow;
}

