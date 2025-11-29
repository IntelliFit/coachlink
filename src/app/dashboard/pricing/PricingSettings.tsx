'use client';

import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Checkbox } from 'primereact/checkbox';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface Pricing {
    id?: string;
    title: string;
    price: number;
    features: string[];
    is_recommend: boolean;
}

interface PricingSettingsProps {
    coachId: string;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({ coachId }) => {
    const [pricings, setPricings] = useState<Pricing[]>([{ title: '', price: 0, features: [''], is_recommend: false }]);
    const [saving, setSaving] = useState<boolean>(false);
    const { showToast } = useToastContext();
    const load = async () => {
        const res = await coachService.getPricing();
        if (res) {
            setPricings(res.pricings);
        } else {
            showToast({ severity: 'error', summary: '获取定价信息失败' });
        }
    }

    useEffect(() => {
        load();
    }, [coachId]);

    const addTier = () => {
        if (pricings.length >= 3) {
            showToast({ severity: 'error', summary: '错误', detail: '最多只能添加三个定价档位' });
            return;
        }

        const newTier: Pricing = {
            id: Date.now().toString(),
            title: '',
            price: 0,
            features: [''],
            is_recommend: false
        };

        setPricings([...pricings, newTier]);
    };

    const removeTier = (id: string) => {
        if (pricings.length <= 1) {
            showToast({ severity: 'error', summary: '错误', detail: '至少需要保留一个定价档位' });
            return;
        }

        setPricings(pricings.filter(tier => tier.id !== id));
    };

    const updateTier = (id: string, field: keyof Pricing, value: any) => {
        setPricings(pricings.map(tier =>
            tier.id === id ? { ...tier, [field]: value } : tier
        ));
    };

    const updateFeature = (tierId: string, index: number, value: string) => {
        setPricings(pricings.map(tier => {
            if (tier.id === tierId) {
                const newFeatures = [...tier.features];
                newFeatures[index] = value;
                return { ...tier, features: newFeatures };
            }
            return tier;
        }));
    };

    const addFeature = (tierId: string) => {
        setPricings(pricings.map(tier => {
            if (tier.id === tierId) {
                return { ...tier, features: [...tier.features, ''] };
            }
            return tier;
        }));
    };

    const removeFeature = (tierId: string, index: number) => {
        setPricings(pricings.map(tier => {
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
        for (const tier of pricings) {
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
        const recommendedCount = pricings.filter(tier => tier.is_recommend).length;
        if (recommendedCount > 1) {
            showToast({ severity: 'error', summary: '错误', detail: '只能有一个推荐档位' });
            return;
        }

        setSaving(true);
        try {
            const result = await coachService.updatePricing({ pricings });

            if (result) {
                showToast({ severity: 'success', summary: '成功', detail: '价格设置已保存' });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* 左侧 - 定价表单 */}
                    <div className="space-y-8">
                        <div>
                            {/* 标题区 */}
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">设置你的订阅计划</h3>
                                <Button
                                    label="添加档位"
                                    icon="pi pi-plus"
                                    onClick={addTier}
                                    disabled={pricings.length >= 3}
                                    className="p-button-outlined"
                                />
                            </div>

                            {/* 档位列表 */}
                            <div className="space-y-5">
                                {pricings.map((tier, index) => (
                                    <div
                                        key={index}
                                        className="p-4 border border-surface-border rounded-xl bg-surface-50"
                                    >
                                        {/* 标题 + 删除按钮 */}
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="text-md font-medium">档位 {index + 1}</h4>

                                            {pricings.length > 1 && (
                                                <Button
                                                    icon="pi pi-trash"
                                                    onClick={() => removeTier(tier.id)}
                                                    className="p-button-rounded p-button-text p-button-danger"
                                                />
                                            )}
                                        </div>

                                        {/* 表单区域 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                            {/* 订阅标题 */}
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">
                                                    订阅计划标题 *
                                                </label>
                                                <InputText
                                                    value={tier.title}
                                                    onChange={(e) => updateTier(tier.id, 'title', e.target.value)}
                                                    placeholder="例如：基础版、高级版"
                                                    className="w-full"
                                                />
                                            </div>

                                            {/* 价格 */}
                                            <div>
                                                <label className="block text-sm font-medium mb-1">价格 (¥/月) *</label>
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

                                            {/* 推荐 */}
                                            <div className="flex items-end">
                                                <div className="flex items-center">
                                                    <Checkbox
                                                        inputId={`rec-${tier.id}`}
                                                        onChange={e => updateTier(tier.id, 'is_recommend', e.checked ?? false)}
                                                        checked={tier.is_recommend}
                                                    />
                                                    <label htmlFor={`rec-${tier.id}`} className="ml-2 text-sm">
                                                        设置为推荐订阅
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 特点列表 */}
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium mb-2">特点 *</label>

                                            <div className="space-y-2">
                                                {tier.features.map((feature, i) => (
                                                    <div key={i} className="flex">
                                                        <InputText
                                                            value={feature}
                                                            onChange={(e) => updateFeature(tier.id, i, e.target.value)}
                                                            className="flex-1"
                                                            placeholder="输入特点描述"
                                                        />
                                                        <Button
                                                            icon="pi pi-trash"
                                                            onClick={() => removeFeature(tier.id, i)}
                                                            className="p-button-text p-button-danger ml-2"
                                                            disabled={tier.features.length <= 1}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            <Button
                                                label="添加特点"
                                                icon="pi pi-plus"
                                                onClick={() => addFeature(tier.id)}
                                                className="p-button-outlined p-button-sm mt-3"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 保存按钮 */}
                        <div className="flex justify-end">
                            <Button
                                label="保存"
                                icon="pi pi-save"
                                onClick={handleSave}
                                loading={saving}
                                className="w-full md:w-auto"
                            />
                        </div>
                    </div>

                    {/* 右侧 - 展示规则 */}
                    <div className="p-6 bg-surface-50 border border-surface-border rounded-xl h-fit">
                        <h2 className="text-lg font-semibold mb-4">展示规则</h2>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-surface-600">
                            <li>最多可以设置三个定价档位。</li>
                            <li>每个档位必须有标题和价格。</li>
                            <li>价格必须为正数。</li>
                            <li>每个档位可以有多个特点描述。</li>
                            <li>最多只能标记一个档位为“推荐”。</li>
                            <li>“我的主页”页面会显示此处设置的定价策略。</li>
                        </ul>

                        <div className="mt-5 p-4 rounded-lg bg-blue-50 border border-blue-100">
                            <h3 className="font-medium mb-2">提示</h3>
                            <p className="text-sm text-surface-700 leading-relaxed">
                                系统会自动将包含“AI”的档位识别为基础档位，
                                将包含“高级”或“premium”的档位识别为高级档位。
                                其他档位将用于未来扩展功能。
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </Card>

    );
};

export default PricingSettings;