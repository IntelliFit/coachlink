'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { useToastContext } from "@/context/ToastContext";
import { impromptuTrainingService } from "@/app/service/impromptuTrainingService";
import { studentActionLibService } from "@/app/service/studentActionLibService";
import { CoachActionRow, ItemType } from "@/types";
import ActionSetForm from "@/app/dashboard/plan-lib/components/ActionSetForm";
import { CoachPlanAction } from "@/app/api/plan-lib/create-template/entity";

type DraftTrainingItem = CoachPlanAction & {
    localId: string;
    itemType: ItemType;
};

// 复用 PlanDayCard 中的颜色和图标逻辑
const getItemIcon = (type: ItemType) => {
    switch (type) {
        case 'DIET': return 'pi pi-apple';
        case 'CARDIO': return 'pi pi-heart';
        case 'HABIT': return 'pi pi-check-circle';
        default: return 'pi pi-bolt'; // STRENGTH
    }
};

const getItemColorClass = (type: ItemType) => {
    switch (type) {
        case 'DIET': return 'text-orange-500 bg-orange-50';
        case 'CARDIO': return 'text-red-500 bg-red-50';
        case 'HABIT': return 'text-green-500 bg-green-50';
        default: return 'text-primary bg-primary-50';
    }
};

const getItemTypeLabel = (type: ItemType) => {
    switch (type) {
        case 'STRENGTH': return '力量训练';
        case 'CARDIO': return '有氧运动';
        case 'DIET': return '饮食建议';
        case 'HABIT': return '习惯打卡';
        default: return '力量训练';
    }
};

export default function ImpromptuTrainingPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState(true);
    const [trainingItems, setTrainingItems] = useState<DraftTrainingItem[]>([
        {
            localId: `item-${Date.now()}`,
            type: 'no-filter',
            actionId: '',
            setName: '',
            params: {
                '组数': 4,
                '次数': 8,
                '休息时间': 90,
            },
            itemType: 'STRENGTH'
        }
    ]);
    const [starting, setStarting] = useState(false);

    // 加载学员动作库。若为空会按基础档案自动初始化一批动作。
    useEffect(() => {
        const loadActions = async () => {
            try {
                let bootstrapRecommendedIds: string[] = [];
                let bootstrapWorkoutDraft: Array<{
                    actionId: string;
                    actionName: string;
                    itemType: ItemType;
                    params?: Record<string, unknown>;
                    note?: string | null;
                }> = [];
                try {
                    const bootstrapRes = await studentActionLibService.bootstrapFromProfile({
                        minActions: 8,
                        importLimit: 10,
                    });
                    bootstrapRecommendedIds = bootstrapRes?.recommendedActionIds || [];
                    bootstrapWorkoutDraft = (bootstrapRes?.workoutDraft || []) as typeof bootstrapWorkoutDraft;
                } catch (bootstrapError) {
                    // 不阻断后续动作加载，降级为仅加载现有动作
                    console.warn("bootstrap from profile failed:", bootstrapError);
                }

                const res = await studentActionLibService.listActions({
                    page: 1,
                    limit: 1000, // 获取足够多的动作
                });
                if (res) {
                    // StudentActionRow 与 CoachActionRow 结构兼容，统一用 CoachActionRow 给 ActionSetForm
                    const loadedActions = res.actions as unknown as CoachActionRow[];
                    setActions(loadedActions);

                    // 新手默认填充 3 个推荐动作，避免到即兴页仍是空白卡片
                    const currentFirst = trainingItems[0];
                    const shouldAutofill =
                        trainingItems.length === 1 &&
                        !currentFirst?.actionId;

                    if (shouldAutofill && loadedActions.length > 0) {
                        if (bootstrapWorkoutDraft.length > 0) {
                            const draftItems = bootstrapWorkoutDraft
                                .map((d, idx) => {
                                    const matched = loadedActions.find((a) => a.id === d.actionId);
                                    if (!matched) return null;
                                    return {
                                        localId: `item-${Date.now()}-${idx}`,
                                        type: "no-filter" as const,
                                        actionId: matched.id,
                                        setName: matched.name,
                                        params: (d.params && typeof d.params === "object")
                                            ? d.params as Record<string, unknown>
                                            : {
                                                "组数": 3,
                                                "次数": 10,
                                                "休息时间": 90,
                                                load: null,
                                            },
                                        itemType: (d.itemType as ItemType) || (matched.type as ItemType) || "STRENGTH",
                                    };
                                })
                                .filter((x): x is DraftTrainingItem => !!x)
                                .slice(0, 5);
                            if (draftItems.length > 0) {
                                setTrainingItems(draftItems);
                            }
                        } else {
                            const preferred = (bootstrapRecommendedIds.length > 0
                                ? loadedActions.filter((a) => bootstrapRecommendedIds.includes(a.id))
                                : loadedActions
                            ).slice(0, 3);

                            if (preferred.length > 0) {
                                setTrainingItems(
                                    preferred.map((action, idx) => ({
                                        localId: `item-${Date.now()}-${idx}`,
                                        type: "no-filter",
                                        actionId: action.id,
                                        setName: action.name,
                                        params: {
                                            "组数": 3,
                                            "次数": 10,
                                            "休息时间": 90,
                                        },
                                        itemType: (action.type as ItemType) || "STRENGTH",
                                    })),
                                );
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load actions", error);
                showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作库' });
            } finally {
                setLoadingActions(false);
            }
        };

        if (session?.user) {
            loadActions();
        }
    }, [session, showToast]);

    const appendItem = () => {
        setTrainingItems(prev => [
            ...prev,
            {
                localId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'no-filter',
                actionId: '',
                setName: '',
                params: {
                    '组数': 4,
                    '次数': 8,
                    '休息时间': 90,
                },
                itemType: 'STRENGTH'
            }
        ]);
    };

    const removeItem = (index: number) => {
        setTrainingItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleActionSetChange = (
        dayIndex: number, // unused
        setIndex: number,
        field: string,
        value: string | number | object
    ) => {
        setTrainingItems(prev => {
            const newItems = [...prev];
            const item = { ...newItems[setIndex] };
            
            if (field === 'params') {
                item.params = { ...item.params, ...(value as any) };
            } else if (field === 'actionId') {
                item.actionId = value as string;
                // 重置参数为默认值或根据动作类型调整
                // 这里简单保留原有参数，ActionSetForm 会处理一些逻辑
            } else {
                (item as any)[field] = value;
            }
            
            newItems[setIndex] = item;
            return newItems;
        });
    };

    // 转换为 Dropdown 选项
    const actionOptions = actions.map(action => ({
        label: action.name,
        value: action.id,
        action: action
    }));

    const getFilteredOptions = (itemType: ItemType) => {
        return actionOptions.filter(opt => {
            if (itemType === 'STRENGTH') {
                return !opt.action.type || opt.action.type === 'STRENGTH';
            }
            return opt.action.type === itemType;
        });
    };

    const handleStart = async () => {
        // 验证
        const invalidItem = trainingItems.find(item => !item.actionId);
        if (invalidItem) {
            showToast({
                severity: "warn",
                summary: "请完善信息",
                detail: "所有训练项都必须选择一个动作",
            });
            return;
        }

        setStarting(true);
        try {
            const payload = {
                actions: trainingItems.map(item => {
                    const action = actions.find(a => a.id === item.actionId);
                    // 转换参数
                    const sets = Number(item.params?.['组数'] || 1);
                    const reps = Number(item.params?.['次数'] || 1);
                    // ActionSetForm 内部存储“休息时间”为秒，这里不能再乘 60
                    const restSecondsRaw = Number(item.params?.['休息时间'] || 90);
                    const restSeconds = Number.isFinite(restSecondsRaw) && restSecondsRaw > 0
                        ? Math.round(restSecondsRaw)
                        : 90;
                    
                    // 重量处理: 优先取 load，其次看 intensityConfig (ActionSetForm 的逻辑)
                    // ActionSetForm 会把计算结果写回 load
                    const load = item.params?.load !== undefined ? Number(item.params.load) : null;

                    return {
                        actionId: item.actionId,
                        actionName: action?.name || '未知动作',
                        sets: sets,
                        reps: reps,
                        weight: load,
                        restSeconds,
                    };
                })
            };

            const data = await impromptuTrainingService.start(payload);
            
            if (!data?.id) {
                throw new Error("创建即兴训练失败");
            }
            
            showToast({
                severity: "success",
                summary: "开始成功",
                detail: "已进入训练执行页",
            });
            router.push(`/training-execution/impromptu?impromptuId=${data.id}&dayIndex=1`);
        } catch (error: any) {
            showToast({
                severity: "error",
                summary: "开始失败",
                detail: error?.message || "请稍后再试",
            });
        } finally {
            setStarting(false);
        }
    };

    const actionName = (item: DraftTrainingItem) => {
         const action = actions.find(a => a.id === item.actionId);
         return action?.name;
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">即兴锻炼</h1>
                    <p className="text-surface-500 text-sm mt-1">
                        先选动作与组次，再进入标准执行页训练
                    </p>
                </div>
                <Button
                    label="返回训练"
                    text
                    icon="pi pi-arrow-left"
                    onClick={() => router.push("/today-training")}
                />
            </div>

            <Card className="shadow-none border border-surface-200 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-surface-900">想做长期规划？</h2>
                        <p className="text-sm text-surface-500">可进入 AI 计划编辑器，确认后按周期执行。</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            label="继续即兴"
                            icon="pi pi-bolt"
                            severity="secondary"
                            outlined
                            onClick={() => {
                                const target = document.querySelector('#impromptu-action-form');
                                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                        />
                        <Button
                            label="AI长期计划"
                            icon="pi pi-calendar-plus"
                            onClick={() => router.push('/me/plan-lib/create')}
                        />
                    </div>
                </div>
            </Card>

            <Card id="impromptu-action-form" className="shadow-none border border-surface-200 rounded-3xl">
                <div className="flex flex-col gap-4">
                     {/* 操作栏 */}
                     <div className="flex gap-3 mb-2">
                        <Button
                            label="添加项目"
                            icon="pi pi-plus"
                            outlined
                            className="flex-1"
                            onClick={appendItem}
                            disabled={loadingActions}
                        />
                        <Button
                            label="开始训练"
                            icon="pi pi-play"
                            className="flex-1"
                            onClick={handleStart}
                            loading={starting}
                            disabled={trainingItems.length === 0 || starting || loadingActions}
                        />
                    </div>

                    <div className="space-y-4">
                        {trainingItems.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-surface-200 p-6 text-center text-surface-500 text-sm">
                                暂无训练项，请先添加项目
                            </div>
                        )}
                        {trainingItems.map((item, idx) => {
                             const itemType = (item.itemType || 'STRENGTH') as ItemType;
                             const setName = actionName(item) || '选择动作';
                             const filteredOptions = getFilteredOptions(itemType);

                             return (
                                <div
                                    key={item.localId}
                                    className="group relative rounded-[24px] p-4 bg-surface-0 border border-surface-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                                >
                                    {/* 头部信息 */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-3 items-center">
                                            <span className="text-xs font-black text-surface-400 shrink-0">#{idx + 1}</span>
                                            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${getItemColorClass(itemType)}`}>
                                                <i className={`pi ${getItemIcon(itemType)} text-base`} />
                                            </div>
                                            <div className="flex flex-col justify-center gap-0.5">
                                                <h5 className="text-base font-black text-surface-900 tracking-tight leading-none">
                                                    {setName}
                                                </h5>
                                                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest leading-none">
                                                    {getItemTypeLabel(itemType)}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            icon="pi pi-trash"
                                            text
                                            rounded
                                            severity="secondary"
                                            className="w-8 h-8 !p-0 text-surface-300 hover:text-red-500 hover:bg-red-50"
                                            onClick={() => removeItem(idx)}
                                        />
                                    </div>

                                    <div className="flex p-1 bg-surface-100/80 rounded-[12px] w-fit mb-3 border border-surface-200/50 overflow-x-auto max-w-full">
                                        {[
                                            { label: '力量', value: 'STRENGTH' },
                                            { label: '有氧', value: 'CARDIO' },
                                            { label: '饮食', value: 'DIET' },
                                            { label: '习惯', value: 'HABIT' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() =>
                                                    setTrainingItems(prev => prev.map((it, i) => i === idx ? {
                                                        ...it,
                                                        itemType: opt.value as ItemType,
                                                        actionId: '',
                                                        setName: '',
                                                    } : it))
                                                }
                                                className={`
                                                    px-3 py-1.5 rounded-[9px] text-[12px] font-bold transition-all whitespace-nowrap
                                                    ${itemType === opt.value
                                                        ? 'bg-surface text-surface-900 shadow-sm'
                                                        : 'text-surface-500 hover:text-surface-700'}
                                                `}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* 表单区域 - 复用 ActionSetForm */}
                                    <div className="md:bg-surface-50/30 md:rounded-[20px] p-0 md:p-1">
                                        <ActionSetForm
                                            set={item}
                                            setIndex={idx}
                                            actionOptions={filteredOptions}
                                            dayIndex={0} // 此时不需要区分天
                                            saving={starting}
                                            onActionSetChange={handleActionSetChange}
                                            actions={actions}
                                            // 即兴训练暂不传入 studentData (如果没有)
                                            // 或者如果能获取到当前用户的 student profile 也可以传入，用于自动计算
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>
    );
}
