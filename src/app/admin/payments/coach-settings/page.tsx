'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Dialog } from 'primereact/dialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { useToastContext } from '@/context/ToastContext';

interface Coach {
    id: string;
    name: string;
    payment_mode: string | null;
    allow_personal_qrcode: boolean;
    payment_qr_codes: any[];
}

const paymentModeOptions = [
    { label: '使用全局默认', value: null },
    { label: '教练个人二维码', value: 'qrcode' },
    { label: '平台支付宝接口', value: 'alipay_api' },
    { label: '双模式（用户选择）', value: 'both' }
];

export default function CoachPaymentSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [globalDefaultMode, setGlobalDefaultMode] = useState<string>('qrcode');
    const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        loadData();
    }, [session, status]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 获取全局设置
            const settingsRes = await fetch('/api/admin/settings?key=payment_mode');
            const settingsData = await settingsRes.json();
            if (settingsData.success && settingsData.data.settings.length > 0) {
                setGlobalDefaultMode(settingsData.data.settings[0].value?.default_mode || 'qrcode');
            }

            // 获取所有教练列表
            const coachesRes = await fetch('/api/coach/get-all-coaches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const coachesData = await coachesRes.json();

            if (coachesData.success) {
                setCoaches(coachesData.data.coaches || []);
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载数据失败' });
        } finally {
            setLoading(false);
        }
    };

    const openEditDialog = (coach: Coach) => {
        setEditingCoach({ ...coach });
        setEditDialogVisible(true);
    };

    const handleSave = async () => {
        if (!editingCoach) return;

        setSaving(true);
        try {
            const res = await fetch('/api/admin/coach-payment-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coachId: editingCoach.id,
                    paymentMode: editingCoach.payment_mode,
                    allowPersonalQrcode: editingCoach.allow_personal_qrcode
                })
            });

            const data = await res.json();

            if (data.success) {
                showToast({ severity: 'success', summary: '成功', detail: '设置已保存' });
                setEditDialogVisible(false);
                // 更新本地数据
                setCoaches(coaches.map(c => 
                    c.id === editingCoach.id 
                        ? { ...c, payment_mode: editingCoach.payment_mode, allow_personal_qrcode: editingCoach.allow_personal_qrcode }
                        : c
                ));
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message });
            }
        } catch (error) {
            console.error('保存失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    const getPaymentModeLabel = (mode: string | null) => {
        if (!mode) return `全局默认 (${getGlobalModeLabel()})`;
        const option = paymentModeOptions.find(o => o.value === mode);
        return option?.label || mode;
    };

    const getGlobalModeLabel = () => {
        switch (globalDefaultMode) {
            case 'qrcode': return '二维码';
            case 'alipay_api': return '平台支付宝';
            case 'both': return '双模式';
            default: return globalDefaultMode;
        }
    };

    const paymentModeTemplate = (coach: Coach) => {
        const isDefault = !coach.payment_mode;
        return (
            <Tag 
                value={getPaymentModeLabel(coach.payment_mode)} 
                severity={isDefault ? 'secondary' : 'info'}
            />
        );
    };

    const qrcodeStatusTemplate = (coach: Coach) => {
        const hasQrCodes = coach.payment_qr_codes && coach.payment_qr_codes.length > 0;
        return (
            <div className="flex items-center gap-2">
                <Tag 
                    value={coach.allow_personal_qrcode ? '允许' : '禁止'} 
                    severity={coach.allow_personal_qrcode ? 'success' : 'danger'}
                />
                {coach.allow_personal_qrcode && (
                    <span className="text-sm text-surface-500">
                        ({hasQrCodes ? `${coach.payment_qr_codes.length}个` : '未上传'})
                    </span>
                )}
            </div>
        );
    };

    const actionTemplate = (coach: Coach) => {
        return (
            <Button
                icon="pi pi-pencil"
                className="p-button-text p-button-sm"
                onClick={() => openEditDialog(coach)}
                tooltip="编辑设置"
            />
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 p-4 bg-surface-100 rounded-lg">
                <div className="text-sm text-surface-600">
                    <strong>全局默认模式：</strong> {getGlobalModeLabel()}
                    <span className="text-surface-400 ml-2">
                        （在"平台设置"中修改）
                    </span>
                </div>
            </div>

            <DataTable
                value={coaches}
                paginator
                rows={10}
                rowsPerPageOptions={[10, 20, 50]}
                emptyMessage="暂无教练数据"
                className="p-datatable-sm"
            >
                <Column field="name" header="教练名称" sortable />
                <Column header="支付模式" body={paymentModeTemplate} />
                <Column header="个人二维码" body={qrcodeStatusTemplate} />
                <Column header="操作" body={actionTemplate} style={{ width: '80px' }} />
            </DataTable>

            {/* 编辑对话框 */}
            <Dialog
                header={`编辑 ${editingCoach?.name} 的支付设置`}
                visible={editDialogVisible}
                onHide={() => setEditDialogVisible(false)}
                style={{ width: '90%', maxWidth: '500px' }}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button
                            label="取消"
                            className="p-button-text"
                            onClick={() => setEditDialogVisible(false)}
                        />
                        <Button
                            label="保存"
                            icon="pi pi-save"
                            onClick={handleSave}
                            loading={saving}
                        />
                    </div>
                }
            >
                {editingCoach && (
                    <div className="space-y-4 p-2">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                                支付模式
                            </label>
                            <Dropdown
                                value={editingCoach.payment_mode}
                                options={paymentModeOptions}
                                onChange={(e) => setEditingCoach({ ...editingCoach, payment_mode: e.value })}
                                placeholder="选择支付模式"
                                className="w-full"
                            />
                            <p className="text-xs text-surface-500 mt-1">
                                选择"使用全局默认"则跟随平台设置
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                                允许使用个人二维码
                            </label>
                            <div className="flex items-center gap-3">
                                <InputSwitch
                                    checked={editingCoach.allow_personal_qrcode}
                                    onChange={(e) => setEditingCoach({ ...editingCoach, allow_personal_qrcode: e.value })}
                                />
                                <span className="text-sm text-surface-600">
                                    {editingCoach.allow_personal_qrcode ? '允许' : '禁止'}
                                </span>
                            </div>
                            <p className="text-xs text-surface-500 mt-1">
                                禁止后，该教练将无法上传和使用个人收款码
                            </p>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
