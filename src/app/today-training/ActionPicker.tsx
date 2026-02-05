'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Skeleton } from 'primereact/skeleton';
import { Search, Dumbbell } from 'lucide-react';

interface StudentAction {
    id: string;
    name: string;
    type: string;
    detail?: string;
    attrs?: any;
}

interface ActionPickerProps {
    visible: boolean;
    onHide: () => void;
    onSelect: (action: StudentAction) => void;
    userId: string;
}

const ActionPicker: React.FC<ActionPickerProps> = ({
    visible,
    onHide,
    onSelect,
    userId
}) => {
    const [loading, setLoading] = useState(false);
    const [actions, setActions] = useState<StudentAction[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible && userId) {
            loadActions();
        }
    }, [visible, userId]);

    const loadActions = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch('/api/student/action-lib/list-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: 1, limit: 100 })
            });
            const data = await res.json();

            if (data.success && data.data?.actions) {
                // 只显示力量训练类型的动作
                const strengthActions = data.data.actions.filter(
                    (a: StudentAction) => a.type === 'STRENGTH' || !a.type
                );
                setActions(strengthActions);
            } else {
                setError(data.message || '加载失败');
            }
        } catch (err) {
            console.error('Load actions failed:', err);
            setError('加载动作库失败');
        } finally {
            setLoading(false);
        }
    };

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
            header="选择动作"
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
                            {searchTerm ? '未找到匹配的动作' : '您的动作库为空'}
                        </div>
                    ) : (
                        filteredActions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => handleSelect(action)}
                                className="w-full p-4 border border-surface-200 rounded-2xl hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Dumbbell className="w-5 h-5 text-primary-600" />
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
                        ))
                    )}
                </div>
            </div>
        </Dialog>
    );
};

export default ActionPicker;
