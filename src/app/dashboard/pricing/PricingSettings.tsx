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

interface Pricing {
    id?: string;
    title: string;
    price: number;
    features: string[];
    is_recommend: boolean;
}

interface PricingSettingsProps {
    coachId: string;
    initialPricingTiers: Pricing[];
    onPricingUpdate: (tiers: Pricing[]) => void;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({
    coachId,
    initialPricingTiers,
    onPricingUpdate
}) => {
    const [pricingTiers, setPricingTiers] = useState<Pricing[]>(initialPricingTiers || [
        { title: '', price: 0, features: [''], is_recommend: false }
    ]);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const { showToast } = useToastContext();

    const addTier = () => {
        if (pricingTiers.length >= 3) {
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
        
        setPricingTiers([...pricingTiers, newTier]);
    };

    const removeTier = (id: string) => {
        if (pricingTiers.length <= 1) {
            showToast({ severity: 'error', summary: '错误', detail: '至少需要保留一个定价档位' });
            return;
        }
        
        setPricingTiers(pricingTiers.filter(tier => tier.id !== id));
    };

    const updateTier = (id: string, field: keyof Pricing, value: any) => {
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
        const recommendedCount = pricingTiers.filter(tier => tier.is_recommend).length;
        if (recommendedCount > 1) {
            showToast({ severity: 'error', summary: '错误', detail: '只能有一个推荐档位' });
            return;
        }

        setSaving(true);
        try {
            // 准备保存的数据
            const pricings = pricingTiers.map(tier => ({
                title: tier.title,
                price: tier.price,
                features: tier.features,
                is_recommend: tier.is_recommend
            }));

            const result = await coachService.updatePricing({
                coach_id: coachId,
                pricings: pricings
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
        <Card title="价格设置">
            <div className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 左侧表单 */}
                    <div>
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium">定价档位</h3>
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
                                    <div key={tier.id || index} className="p-4 border-round border-1 surface-border">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-md font-medium">档位 {index + 1}</h4>
                                            {pricingTiers.length > 1 && (
                                                <Button 
                                                    icon="pi pi-trash" 
                                                    onClick={() => tier.id && removeTier(tier.id)}
                                                    className="p-button-rounded p-button-text p-button-danger"
                                                />
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="md:col-span-2">
                                                <label className="block font-medium mb-2">标题 *</label>
                                                <InputText
                                                    value={tier.title}
                                                    onChange={(e) => updateTier(tier.id || '', 'title', e.target.value)}
                                                    className="w-full"
                                                    placeholder="例如：基础版、高级版"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block font-medium mb-2">价格 (¥/月) *</label>
                                                <InputNumber
                                                    value={tier.price}
                                                    onValueChange={(e) => updateTier(tier.id || '', 'price', e.value ?? 0)}
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
                                                        inputId={`recommended-${tier.id || index}`} 
                                                        onChange={e => updateTier(tier.id || '', 'is_recommend', e.checked || false)} 
                                                        checked={tier.is_recommend} 
                                                    />
                                                    <label htmlFor={`recommended-${tier.id || index}`} className="ml-2">
                                                        推荐档位
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
                                                            onChange={(e) => updateFeature(tier.id || '', featureIndex, e.target.value)}
                                                            className="flex-1"
                                                            placeholder="输入特点描述"
                                                        />
                                                        <Button 
                                                            icon="pi pi-trash" 
                                                            onClick={() => removeFeature(tier.id || '', featureIndex)}
                                                            className="p-button-rounded p-button-text p-button-danger ml-2"
                                                            disabled={tier.features.length <= 1}
                                                        />
                                                    </div>
                                                ))}
                                                <Button 
                                                    label="添加特点" 
                                                    icon="pi pi-plus" 
                                                    onClick={() => addFeature(tier.id || '')}
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
                                <li>学员侧教练主页中的"服务与定价"模块将实时读取此处设置。</li>
                            </ul>
                            
                            <div className="mt-4 p-3 bg-blue-50 border-round">
                                <h3 className="font-medium mb-2">提示</h3>
                                <p className="text-sm">
                                    您可以自定义定价档位的标题、价格和特点描述。被标记为推荐的档位会在学员端突出显示。
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