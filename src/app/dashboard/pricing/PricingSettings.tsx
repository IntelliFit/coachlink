'use client';

import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface PricingSettingsProps {
    coachId: string;
    initialAiPrice: number;
    initialPremiumPrice: number;
    onPricingUpdate: (aiPrice: number, premiumPrice: number) => void;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({
    coachId,
    initialAiPrice,
    initialPremiumPrice,
    onPricingUpdate
}) => {
    const [aiPrice, setAiPrice] = useState<number>(initialAiPrice);
    const [premiumPrice, setPremiumPrice] = useState<number>(initialPremiumPrice);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const { showToast } = useToastContext();

    const handleSave = async () => {
        if (aiPrice <= 0 || premiumPrice <= 0) {
            showToast({ severity: 'error', summary: '错误', detail: '价格必须为正数' });
            return;
        }

        if (premiumPrice <= aiPrice) {
            showToast({ severity: 'error', summary: '错误', detail: '高级版价格必须高于AI版价格' });
            return;
        }

        setSaving(true);
        try {
            const result = await coachService.updatePricing({
                coach_id: coachId,
                ai_monthly: Math.round(aiPrice),
                premium_monthly: Math.round(premiumPrice)
            });

            if (result) {
                setSaved(true);
                onPricingUpdate(aiPrice, premiumPrice);
                setTimeout(() => setSaved(false), 2000);
                showToast({ severity: 'success', summary: '成功', detail: '价格设置已保存' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card title="价格设置">
            <div className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 左侧表单 */}
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
                            <div>
                                <label className="block font-medium mb-2">AI版价格 (¥/月)</label>
                                <InputNumber
                                    value={aiPrice}
                                    onValueChange={(e) => setAiPrice(e.value ?? 0)}
                                    mode="currency"
                                    currency="CNY"
                                    locale="zh-CN"
                                    min={1}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block font-medium mb-2">高级版价格 (¥/月)</label>
                                <InputNumber
                                    value={premiumPrice}
                                    onValueChange={(e) => setPremiumPrice(e.value ?? 0)}
                                    mode="currency"
                                    currency="CNY"
                                    locale="zh-CN"
                                    min={1}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 w-full justify-between mt-10">
                            <div></div>
                            <Button
                                label="保存"
                                icon="pi pi-save"
                                onClick={handleSave}
                                loading={saving}
                                className="w-full md:w-auto"
                            />
                        </div>
                    </div>

                    {/* 右侧展示规则 */}
                    <div>
                        <div className="p-4 text-surface-600">
                            <h2>展示规则</h2>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>价格必须为正数。</li>
                                <li>高级版价格必须高于 AI版价格。</li>
                                <li>学员侧教练主页中的"服务与定价"模块将实时读取此处设置。</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default PricingSettings;