'use client';

import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Message } from "primereact/message";
import type { CoachActionRow } from "@/types";
import { actionLibService } from "@/app/service/actionLibService";
import type { ActionReferencesResponseDto } from "@/app/api/action-lib/action-references/entity";

export default function MergeActionsDialog(props: {
    visible: boolean;
    actions: CoachActionRow[];
    onHide: () => void;
    onSuccess: (result: { replacedCount: number; updatedTemplates: number; updatedInstances: number; deletedActions: number }) => void;
}) {
    const { visible, actions, onHide, onSuccess } = props;

    const options = useMemo(
        () => actions.map((a) => ({ label: a.name, value: a.id })),
        [actions],
    );

    const [keepId, setKeepId] = useState<string>("");
    const mergeIds = useMemo(
        () => actions.map((a) => a.id).filter((id) => id && id !== keepId),
        [actions, keepId],
    );

    const [deleteMerged, setDeleteMerged] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [preview, setPreview] = useState<ActionReferencesResponseDto | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setKeepId(actions[0]?.id || "");
        setDeleteMerged(false);
        setPreview(null);
        setPreviewLoading(false);
        setSubmitting(false);
    }, [visible, actions]);

    const handlePreview = async () => {
        if (!keepId || mergeIds.length === 0) return;
        setPreviewLoading(true);
        try {
            const res = await actionLibService.getActionReferences({ actionIds: mergeIds });
            setPreview(res);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!keepId || mergeIds.length === 0) return;
        setSubmitting(true);
        try {
            const res = await actionLibService.mergeActions({
                keepActionId: keepId,
                mergeActionIds: mergeIds,
                applyToTemplates: true,
                applyToInstances: true,
                deleteMerged,
            });
            onSuccess(res);
            onHide();
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
                label="预览影响范围"
                icon="pi pi-search"
                outlined
                onClick={handlePreview}
                loading={previewLoading}
                disabled={!keepId || mergeIds.length === 0 || submitting}
            />
            <div className="flex gap-2 justify-end">
                <Button
                    label="取消"
                    outlined
                    onClick={onHide}
                    disabled={submitting}
                />
                <Button
                    label="执行合并"
                    icon="pi pi-check"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!keepId || mergeIds.length === 0}
                />
            </div>
        </div>
    );

    return (
        <Dialog
            header="合并/去重动作"
            visible={visible}
            onHide={onHide}
            style={{ width: "min(820px, 96vw)" }}
            footer={footer}
            modal
        >
            <div className="space-y-4">
                <div className="text-sm text-surface-700">
                    请选择一个“保留动作”，其余动作会被替换成该动作的引用（模板 + 学员计划实例）。
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-semibold text-surface-800">保留动作</div>
                    <Dropdown
                        value={keepId}
                        options={options}
                        onChange={(e) => setKeepId(e.value)}
                        placeholder="选择保留动作"
                        className="w-full"
                    />
                    <div className="text-xs text-surface-500">
                        将被合并动作：{mergeIds.length} 个
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl border border-surface-200 bg-surface-50">
                    <Checkbox
                        inputId="deleteMerged"
                        checked={deleteMerged}
                        onChange={(e) => setDeleteMerged(!!e.checked)}
                    />
                    <label htmlFor="deleteMerged" className="text-sm text-surface-700">
                        合并后删除被合并动作（不可撤销，默认不勾选更安全）
                    </label>
                </div>

                {preview && (
                    <div className="space-y-3">
                        <Message
                            severity="info"
                            text={`将影响模板 ${preview.totals.templateCount} 个、计划实例 ${preview.totals.instanceCount} 个，共 ${preview.totals.matchCount} 处引用`}
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
            </div>
        </Dialog>
    );
}

