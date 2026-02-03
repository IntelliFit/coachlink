/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import type { CoachActionRow } from "@/types";
import { actionLibService } from "@/app/service/actionLibService";
import type { ActionReferencesResponseDto } from "@/app/api/action-lib/action-references/entity";
import { useToastContext } from "@/context/ToastContext";

export default function DeleteActionDialog(props: {
    visible: boolean;
    action: CoachActionRow | null;
    onHide: () => void;
    onCompleted: () => void;
}) {
    const { visible, action, onHide, onCompleted } = props;
    const { showToast } = useToastContext();

    const [previewLoading, setPreviewLoading] = useState(false);
    const [preview, setPreview] = useState<ActionReferencesResponseDto | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [replacementId, setReplacementId] = useState<string>("");
    const [replaceLoading, setReplaceLoading] = useState(false);
    const [replaceOptions, setReplaceOptions] = useState<CoachActionRow[]>([]);

    const availableOptions = useMemo(
        () =>
            replaceOptions
                .filter((item) => item.id !== action?.id)
                .map((item) => ({ label: item.name, value: item.id })),
        [replaceOptions, action?.id],
    );

    const loadPreview = async () => {
        if (!action?.id) return;
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const res = await actionLibService.getActionReferences({ actionIds: [action.id] });
            setPreview(res);
        } catch (e: any) {
            setPreviewError(e?.message || "无法获取影响范围");
        } finally {
            setPreviewLoading(false);
        }
    };

    const loadReplaceOptions = async () => {
        setReplaceLoading(true);
        try {
            const res = await actionLibService.listActions({
                page: 1,
                limit: 200,
            });
            setReplaceOptions(res.actions || []);
        } catch (e: any) {
            showToast({ severity: "error", summary: "加载失败", detail: e?.message || "无法加载动作列表" });
        } finally {
            setReplaceLoading(false);
        }
    };

    useEffect(() => {
        if (!visible) return;
        setPreview(null);
        setReplacementId("");
        setPreviewError(null);
        loadPreview();
        loadReplaceOptions();
    }, [visible, action?.id]);

    const handleSubmit = async () => {
        if (!action?.id) return;
        setSubmitting(true);
        try {
            if (replacementId) {
                const res = await actionLibService.mergeActions({
                    keepActionId: replacementId,
                    mergeActionIds: [action.id],
                    applyToTemplates: true,
                    applyToInstances: true,
                    deleteMerged: true,
                });
                showToast({
                    severity: "success",
                    summary: "替换完成",
                    detail: `已替换 ${res.replacedCount} 处引用`,
                });
            } else {
                await actionLibService.deleteAction({ id: action.id, removeReferences: true });
                showToast({ severity: "success", summary: "删除成功", detail: "动作已删除" });
            }
            onCompleted();
            onHide();
        } catch (e: any) {
            showToast({ severity: "error", summary: "操作失败", detail: e?.message || "请稍后再试" });
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
                label="刷新影响范围"
                icon="pi pi-refresh"
                outlined
                onClick={loadPreview}
                loading={previewLoading}
                disabled={!action?.id || submitting}
            />
            <div className="flex gap-2 justify-end">
                <Button label="取消" outlined onClick={onHide} disabled={submitting} />
                <Button
                    label={replacementId ? "替换并删除" : "确认删除"}
                    icon="pi pi-check"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!action?.id || submitting}
                    className={replacementId ? "" : "p-button-danger"}
                />
            </div>
        </div>
    );

    const totalMatches = preview?.totals.matchCount ?? 0;

    return (
        <Dialog
            header={`删除动作${action?.name ? `：${action.name}` : ""}`}
            visible={visible}
            onHide={onHide}
            style={{ width: "min(860px, 96vw)" }}
            footer={footer}
            modal
        >
            <div className="space-y-4">
                <div className="text-sm text-surface-700">
                    删除动作前请确认影响范围，可选择替代动作以自动替换模板与计划实例中的引用。
                </div>

                {previewLoading && (
                    <Message severity="info" text="正在统计影响范围..." />
                )}
                {previewError && (
                    <Message severity="error" text={previewError} />
                )}
                {!previewLoading && !previewError && preview && (
                    <div className="space-y-3">
                        <Message
                            severity="info"
                            text={
                                totalMatches > 0
                                    ? `将影响模板 ${preview.totals.templateCount} 个、计划实例 ${preview.totals.instanceCount} 个，共 ${totalMatches} 处引用`
                                    : "未发现该动作的引用记录"
                            }
                        />

                        {preview.templates.length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-surface-800 mb-2">受影响的模板</div>
                                <ul className="text-sm text-surface-700 space-y-1">
                                    {preview.templates.slice(0, 8).map((t) => (
                                        <li key={t.templateId} className="flex justify-between gap-2">
                                            <span className="truncate">{t.name}</span>
                                            <span className="text-surface-500 shrink-0">{t.matchCount} 处</span>
                                        </li>
                                    ))}
                                </ul>
                                {preview.templates.length > 8 && (
                                    <div className="text-xs text-surface-500 mt-2">
                                        还有 {preview.templates.length - 8} 个模板未展示
                                    </div>
                                )}
                            </div>
                        )}

                        {preview.instances.length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-surface-800 mb-2">受影响的计划实例</div>
                                <ul className="text-sm text-surface-700 space-y-1">
                                    {preview.instances.slice(0, 8).map((i) => (
                                        <li key={i.instanceId} className="flex justify-between gap-2">
                                            <span className="truncate">{i.name}</span>
                                            <span className="text-surface-500 shrink-0">{i.matchCount} 处</span>
                                        </li>
                                    ))}
                                </ul>
                                {preview.instances.length > 8 && (
                                    <div className="text-xs text-surface-500 mt-2">
                                        还有 {preview.instances.length - 8} 个计划实例未展示
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {totalMatches > 0 && !replacementId && (
                    <Message severity="warn" text="该动作有引用记录，若不选择替代动作，将直接从模板与计划实例中移除此动作位置。" />
                )}

                <div className="space-y-2 pt-2">
                    <div className="text-sm font-semibold text-surface-800">可选：替代动作</div>
                    <Dropdown
                        value={replacementId}
                        options={availableOptions}
                        onChange={(e) => setReplacementId(e.value)}
                        placeholder="选择替代动作（不选则直接删除）"
                        className="w-full"
                        disabled={submitting || replaceLoading}
                        filter
                        filterPlaceholder="输入关键词搜索动作"
                        scrollHeight="360px"
                        appendTo="self"
                    />
                    <div className="text-xs text-surface-500">
                        将把模板与计划实例中的该动作替换为所选动作，并删除原动作。
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

