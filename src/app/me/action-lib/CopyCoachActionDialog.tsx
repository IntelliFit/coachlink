'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { useToastContext } from '@/context/ToastContext';
import { CoachActionRow } from '@/types/coach';

interface CopyCoachActionDialogProps {
    visible: boolean;
    onHide: () => void;
    onSuccess: () => void;
}

const CopyCoachActionDialog: React.FC<CopyCoachActionDialogProps> = ({
    visible,
    onHide,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState<string | null>(null);
    const [coachActions, setCoachActions] = useState<(CoachActionRow & { isAdded: boolean })[]>([]);
    const [filteredActions, setFilteredActions] = useState<(CoachActionRow & { isAdded: boolean })[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [coachName, setCoachName] = useState<string | null>(null);
    const { showToast } = useToastContext();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 640px)');
        const update = () => setIsMobile(mql.matches);
        update();
        mql.addEventListener?.('change', update);
        return () => mql.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        if (visible) {
            loadCoachActions();
        }
    }, [visible]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = coachActions.filter(action =>
                action.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                action.detail?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredActions(filtered);
        } else {
            setFilteredActions(coachActions);
        }
    }, [searchTerm, coachActions]);

    const loadCoachActions = async () => {
        setLoading(true);
        try {
            const res = await studentActionLibService.listCoachActions();
            if (res) {
                setCoachActions(res.actions);
                setFilteredActions(res.actions);
                setCoachName(res.coachName);
            }
        } catch (error: any) {
            console.error('加载教练动作库失败:', error);
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: error?.message || '无法加载教练动作库'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyAction = async (actionId: string) => {
        setCopying(actionId);
        try {
            await studentActionLibService.copyCoachAction({ coachActionId: actionId });
            showToast({
                severity: 'success',
                summary: '添加成功',
                detail: '动作已添加到您的动作库'
            });
            onSuccess();
            onHide();
        } catch (error: any) {
            console.error('复制动作失败:', error);
            showToast({
                severity: 'error',
                summary: '添加失败',
                detail: error?.message || '无法添加动作'
            });
        } finally {
            setCopying(null);
        }
    };

    const renderActionCard = (action: CoachActionRow & { isAdded: boolean }) => {
        const positions = action.positions || [];

        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:shadow-sm transition-all mb-2">
                <div className="flex justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-900 mb-2 line-clamp-1">
                            {action.name}
                        </h3>
                        <p className="text-600 text-sm mb-3 line-clamp-2">
                            {action.detail}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {positions.map((pos, index) => (
                                <span
                                    key={index}
                                    className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700"
                                >
                                    {pos}
                                </span>
                            ))}
                            {action.enableAutoWeightCompute && (
                                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                                    智能计算
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        {action.isAdded ? (
                            <Button
                                icon="pi pi-check"
                                label="已添加"
                                className="p-button-sm p-button-outlined p-button-success"
                                disabled
                            />
                        ) : (
                            <Button
                                icon="pi pi-plus"
                                label="添加"
                                className="p-button-sm"
                                loading={copying === action.id}
                                disabled={copying !== null}
                                onClick={() => handleCopyAction(action.id)}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const footer = (
        <div className="flex justify-end">
            <Button label="关闭" className="p-button-text" onClick={onHide} />
        </div>
    );

    return (
        <Dialog
            header={
                <div>
                    <span>从教练动作库添加</span>
                    {coachName && (
                        <span className="text-500 text-sm font-normal ml-2">
                            ({coachName} 的动作库)
                        </span>
                    )}
                </div>
            }
            visible={visible}
            modal
            draggable={false}
            resizable={false}
            dismissableMask
            style={isMobile ? { width: '100vw', height: '100dvh', margin: 0 } : { width: '90vw', maxWidth: '700px' }}
            position={isMobile ? 'bottom' : 'center'}
            footer={footer}
            onHide={onHide}
            pt={{
                root: { className: isMobile ? 'm-0 p-0 rounded-none overflow-hidden' : 'rounded-2xl overflow-hidden' },
                header: { className: isMobile ? 'px-4 py-3 border-b border-surface-200 bg-surface sticky top-0 z-10' : 'px-6 py-4 border-b border-surface-200 bg-surface' },
                content: { className: isMobile ? 'px-4 py-4 bg-surface overflow-auto' : 'px-6 py-5 bg-surface' },
                footer: { className: isMobile ? 'px-4 py-3 border-t border-surface-200 bg-surface sticky bottom-0 z-10' : 'px-6 py-4 border-t border-surface-200 bg-surface' },
            } as any}
        >
            <div className="mb-4">
                <IconField iconPosition="left" className='w-full'>
                    <InputIcon className="pi pi-search" />
                    <InputText
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索动作..."
                        className="w-full"
                    />
                </IconField>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="border rounded-lg p-4">
                            <Skeleton width="100%" height="1.5rem" className="mb-3" />
                            <Skeleton width="80%" height="1rem" className="mb-2" />
                            <Skeleton width="60%" height="1rem" />
                        </div>
                    ))}
                </div>
            ) : filteredActions.length === 0 ? (
                <div className="text-center py-8">
                    <i className="pi pi-inbox text-4xl text-surface-400 mb-4" />
                    <p className="text-600">
                        {coachActions.length === 0
                            ? '您的教练暂未创建动作，或您没有活跃的订阅'
                            : '未找到匹配的动作'}
                    </p>
                </div>
            ) : (
                <DataView
                    value={filteredActions}
                    itemTemplate={renderActionCard}
                    paginator
                    rows={5}
                    emptyMessage="未找到动作"
                />
            )}
        </Dialog>
    );
};

export default CopyCoachActionDialog;
