'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Skeleton } from 'primereact/skeleton';
import { Search, Dumbbell, UtensilsCrossed, Activity, CheckCircle2 } from 'lucide-react';
import { studentActionLibService } from '@/app/service/studentActionLibService';

interface StudentAction {
    id: string;
    name: string;
    type: string;
    detail?: string;
    attrs?: any;
}

const resolveActionVisual = (type?: string) => {
    const normalizedType = String(type || 'STRENGTH').toUpperCase();
    if (normalizedType === 'DIET') {
        return {
            Icon: UtensilsCrossed,
            iconClassName: 'text-emerald-600',
            bgClassName: 'bg-emerald-100',
        };
    }
    if (normalizedType === 'CARDIO') {
        return {
            Icon: Activity,
            iconClassName: 'text-sky-600',
            bgClassName: 'bg-sky-100',
        };
    }
    if (normalizedType === 'HABIT') {
        return {
            Icon: CheckCircle2,
            iconClassName: 'text-violet-600',
            bgClassName: 'bg-violet-100',
        };
    }
    return {
        Icon: Dumbbell,
        iconClassName: 'text-primary-600',
        bgClassName: 'bg-primary-100',
    };
};

interface ActionPickerProps {
    visible: boolean;
    onHide: () => void;
    onSelect: (action: StudentAction) => void;
    userId: string;
    allowedTypes?: string[];
    title?: string;
    emptyText?: string;
}

const DEFAULT_ALLOWED_TYPES = ['STRENGTH'];

const ActionPicker: React.FC<ActionPickerProps> = ({
    visible,
    onHide,
    onSelect,
    userId,
    allowedTypes,
    title = '选择动作',
    emptyText = '您的动作库为空',
}) => {
    const [loading, setLoading] = useState(false);
    const [actions, setActions] = useState<StudentAction[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    const allowedTypesKey = useMemo(() => {
        const sourceTypes = allowedTypes && allowedTypes.length > 0
            ? allowedTypes
            : DEFAULT_ALLOWED_TYPES;
        return sourceTypes
            .map((type) => String(type).toUpperCase())
            .sort()
            .join('|');
    }, [allowedTypes]);

    const normalizedAllowedTypes = useMemo(() => {
        return allowedTypesKey ? allowedTypesKey.split('|') : DEFAULT_ALLOWED_TYPES;
    }, [allowedTypesKey]);

    const loadActions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await studentActionLibService.listActions({ page: 1, limit: 100 });
            const filteredActions = (data?.actions || []).filter((a: StudentAction) => {
                const actionType = String(a.type || 'STRENGTH').toUpperCase();
                return normalizedAllowedTypes.includes(actionType);
            });
            setActions(filteredActions);
        } catch (err) {
            console.error('Load actions failed:', err);
            setError(err instanceof Error ? err.message : '加载动作库失败');
        } finally {
            setLoading(false);
        }
    }, [allowedTypesKey, normalizedAllowedTypes]);

    useEffect(() => {
        if (visible && userId) {
            loadActions();
        }
    }, [visible, userId, allowedTypesKey, loadActions]);

    const filteredActions = searchTerm
        ? actions.filter(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : actions;

    const handleSelect = (action: StudentAction) => {
        onSelect(action);
        onHide();
        setSearchTerm('');
    };

    return (
        <Dialog
            header={title}
            visible={visible}
            onHide={() => {
                onHide();
                setSearchTerm('');
            }}
            draggable={false}
            resizable={false}
            className="w-[min(92vw,520px)]"
        >
            <div className="space-y-4">
                {/* 搜索框 */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <InputText
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索动作名称..."
                        className="w-full pl-10"
                    />
                </div>

                {/* 动作列表 */}
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {loading ? (
                        <>
                            <Skeleton height="60px" />
                            <Skeleton height="60px" />
                            <Skeleton height="60px" />
                        </>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 mb-4">{error}</p>
                            <Button
                                label="重试"
                                onClick={loadActions}
                                outlined
                            />
                        </div>
                    ) : filteredActions.length === 0 ? (
                        <div className="text-center py-8 text-surface-500">
                            {searchTerm ? '未找到匹配的动作' : emptyText}
                        </div>
                    ) : (
                        filteredActions.map((action) => (
                            (() => {
                                const visual = resolveActionVisual(action.type);
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => handleSelect(action)}
                                        className="w-full p-4 border border-surface-200 rounded-2xl hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 ${visual.bgClassName} rounded-full flex items-center justify-center flex-shrink-0`}>
                                                <visual.Icon className={`w-5 h-5 ${visual.iconClassName}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-surface-900 mb-1">
                                                    {action.name}
                                                </h4>
                                                {action.detail && (
                                                    <p className="text-sm text-surface-500 line-clamp-2">
                                                        {action.detail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })()
                        ))
                    )}
                </div>
            </div>
        </Dialog>
    );
};

export default ActionPicker;
