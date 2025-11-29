'use client';

import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Checkbox } from 'primereact/checkbox';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface PricingTier {
    id: string;
    title: string;
    price: number;
    features: string[];
    recommended: boolean;
}

interface PricingSettingsProps {
    coachId: string;
    initialPricingTiers: PricingTier[];
    onPricingUpdate: (tiers: PricingTier[]) => void;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({
    coachId,
    initialPricingTiers,
    onPricingUpdate
}) => {
    const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(initialPricingTiers || [
        { id: '1', title: '', price: 0, features: [''], recommended: false }
    ]);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const { showToast } = useToastContext();

    const addTier = () => {
        if (pricingTiers.length >= 3) {
            showToast({ severity: 'error', summary: '错误', detail: '最多只能添加三个定价档位' });
            return;
        }

        const newTier: PricingTier = {
            id: Date.now().toString(),
            title: '',
            price: 0,
            features: [''],
            recommended: false
        };

        setPricingTiers([...pricingTiers, newTier]);
    };

    const removeTier = (id: string) => {
        if (pricingTiers.length <= 1) {
            showToast({ severity: 'error', summary: '错误', detail: '至少需要保留一个定价档位' });
            return;
        }

        setPricingTiers(pricingTiers.filter(tier => tier.id !== id));
    };

    const updateTier = (id: string, field: keyof PricingTier, value: any) => {
        setPricingTiers(pricingTiers.map(tier =>
            tier.id === id ? { ...tier, [field]: value } : tier
        ));
    };

    const updateFeature = (tierId: string, index: number, value: string) => {
        setPricingTiers(pricingTiers.map(tier => {
            if (tier.id === tierId) {
                const newFeatures = [...tier.features];
                newFeatures[index] = value;
                return { ...tier, features: newFeatures };
            }
            return tier;
        }));
    };

    const addFeature = (tierId: string) => {
        setPricingTiers(pricingTiers.map(tier => {
            if (tier.id === tierId) {
                return { ...tier, features: [...tier.features, ''] };
            }
            return tier;
        }));
    };

    const removeFeature = (tierId: string, index: number) => {
        setPricingTiers(pricingTiers.map(tier => {
            if (tier.id === tierId) {
                const newFeatures = [...tier.features];
                newFeatures.splice(index, 1);
                return { ...tier, features: newFeatures };
            }
            return tier;
        }));
    };

    const handleSave = async () => {
        // 验证数据
        for (const tier of pricingTiers) {
            if (!tier.title.trim()) {
                showToast({ severity: 'error', summary: '错误', detail: '所有定价档位都必须有标题' });
                return;
            }

            if (tier.price <= 0) {
                showToast({ severity: 'error', summary: '错误', detail: '所有定价档位的价格必须为正数' });
                return;
            }

            if (tier.features.some(feature => !feature.trim())) {
                showToast({ severity: 'error', summary: '错误', detail: '所有特点描述都不能为空' });
                return;
            }
        }

        // 检查是否只有一个推荐项
        const recommendedCount = pricingTiers.filter(tier => tier.recommended).length;
        if (recommendedCount > 1) {
            showToast({ severity: 'error', summary: '错误', detail: '只能有一个推荐档位' });
            return;
        }

        setSaving(true);
        try {
            // 由于当前API只支持两个固定档位，我们需要适配现有API
            // 这里我们只取前两个档位保存到现有API
            const aiTier = pricingTiers.find(tier => tier.title.toLowerCase().includes('ai')) || pricingTiers[0];
            const premiumTier = pricingTiers.find(tier => tier.title.toLowerCase().includes('高级') || tier.title.toLowerCase().includes('premium')) ||
                pricingTiers.find(tier => tier !== aiTier) ||
                pricingTiers[1];

            const result = await coachService.updatePricing({
                coach_id: coachId,
                ai_monthly: aiTier ? Math.round(aiTier.price) : 99,
                premium_monthly: premiumTier ? Math.round(premiumTier.price) : 299
            });

            if (result) {
                setSaved(true);
                onPricingUpdate(pricingTiers);
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
        <Card>
            <div className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 左侧表单 */}
                    <div>
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium">设置你的订阅计划</h3>
                                <Button
                                    label="添加档位"
                                    icon="pi pi-plus"
                                    onClick={addTier}
                                    disabled={pricingTiers.length >= 3}
                                    className="p-button-outlined"
                                />
                            </div>

                            <div className="space-y-6">
                                {pricingTiers.map((tier, index) => (
                                    <div key={tier.id} className="p-4 border-round border-1 surface-border">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-md font-medium">档位 {index + 1}</h4>
                                            {pricingTiers.length > 1 && (
                                                <Button
                                                    icon="pi pi-trash"
                                                    onClick={() => removeTier(tier.id)}
                                                    className="p-button-rounded p-button-text p-button-danger"
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="md:col-span-2">
                                                <label className="block font-medium mb-2">订阅计划标题 *</label>
                                                <InputText
                                                    value={tier.title}
                                                    onChange={(e) => updateTier(tier.id, 'title', e.target.value)}
                                                    className="w-full"
                                                    placeholder="例如：基础版、高级版"
                                                />
                                            </div>

                                            <div>
                                                <label className="block font-medium mb-2">价格 (¥/月) *</label>
                                                <InputNumber
                                                    value={tier.price}
                                                    onValueChange={(e) => updateTier(tier.id, 'price', e.value ?? 0)}
                                                    mode="currency"
                                                    currency="CNY"
                                                    locale="zh-CN"
                                                    min={1}
                                                    className="w-full"
                                                />
                                            </div>

                                            <div className="flex align-items-end">
                                                <div className="flex align-items-center">
                                                    <Checkbox
                                                        inputId={`recommended-${tier.id}`}
                                                        onChange={e => updateTier(tier.id, 'recommended', e.checked || false)}
                                                        checked={tier.recommended}
                                                    />
                                                    <label htmlFor={`recommended-${tier.id}`} className="ml-2">
                                                        设置为推荐订阅
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <label className="block font-medium mb-2">特点 *</label>
                                            <div className="space-y-2">
                                                {tier.features.map((feature, featureIndex) => (
                                                    <div key={featureIndex} className="flex">
                                                        <InputText
                                                            value={feature}
                                                            onChange={(e) => updateFeature(tier.id, featureIndex, e.target.value)}
                                                            className="flex-1"
                                                            placeholder="输入特点描述"
                                                        />
                                                        <Button
                                                            icon="pi pi-trash"
                                                            onClick={() => removeFeature(tier.id, featureIndex)}
                                                            className="p-button-rounded p-button-text p-button-danger ml-2"
                                                            disabled={tier.features.length <= 1}
                                                        />
                                                    </div>
                                                ))}
                                                <Button
                                                    label="添加特点"
                                                    icon="pi pi-plus"
                                                    onClick={() => addFeature(tier.id)}
                                                    className="p-button-outlined p-button-sm mt-2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 w-full justify-between mt-6">
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
                                <li>最多可以设置三个定价档位。</li>
                                <li>每个档位必须有标题和价格。</li>
                                <li>价格必须为正数。</li>
                                <li>每个档位可以有多个特点描述。</li>
                                <li>最多只能标记一个档位为"推荐"。</li>
                                <li>“我的主页”页面可以看到此处设置的定价策略</li>
                            </ul>

                            <div className="mt-4 p-3 bg-blue-50 border-round">
                                <h3 className="font-medium mb-2">提示</h3>
                                <p className="text-sm">
                                    当前系统会自动将包含"AI"的档位作为基础档位，包含"高级"或"premium"的档位作为高级档位保存到现有系统中。
                                    其他档位将用于未来扩展功能。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default PricingSettings;