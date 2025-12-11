'use client';

import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { Skeleton } from 'primereact/skeleton';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface Pricing {
    id?: string;
    title: string;
    price: number;
    features: string[];
    is_recommend: boolean;
    is_ai_plan?: boolean;
}

interface PricingSettingsProps {
    coachId: string;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({ coachId }) => {
    const [pricings, setPricings] = useState<Pricing[]>([{ title: '', price: 0, features: [''], is_recommend: false }]);
    const [saving, setSaving] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const { showToast } = useToastContext();
    const load = async () => {
        if (!coachId) {
            setLoading(false);
            return;
        }

        try {
            const res = await coachService.getPricing({ userId: coachId });
            if (res) {
                setPricings(res.pricings);
            } else {
                showToast({ severity: 'error', summary: '获取定价信息失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '获取定价信息失败' });
        } finally {
            setLoading(false);
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

        // 确保新档位的价格比最后一个档位高
        const lastPrice = pricings.length > 0 ? pricings[pricings.length - 1].price : 0;
        const newPrice = Math.max(1, lastPrice + 1); // 至少为1，且比前一个价格高至少1

        const newTier: Pricing = {
            id: Date.now().toString(),
            title: '',
            price: newPrice,
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
        // 创建一个新的定价数组副本
        const updatedPricings = [...pricings];
        const tierIndex = updatedPricings.findIndex(tier => tier.id === id);

        if (tierIndex !== -1) {
            // 更新指定字段
            updatedPricings[tierIndex] = { ...updatedPricings[tierIndex], [field]: value };

            // 如果更新的是价格，则需要确保价格保持严格升序
            if (field === 'price') {
                const newPrice = value as number;

                // 检查是否违反了升序规则
                const isValid = updatedPricings.every((tier, i) => {
                    // 第一个元素没有前置元素比较
                    if (i === 0) return true;
                    // 每个元素必须大于前一个元素
                    return tier.price > updatedPricings[i - 1].price;
                });

                // 如果违反了升序规则，调整其他价格以满足约束
                if (!isValid) {
                    // 确保当前修改的元素大于前一个元素（如果不是第一个）
                    if (tierIndex > 0) {
                        const prevPrice = updatedPricings[tierIndex - 1].price;
                        if (newPrice <= prevPrice) {
                            updatedPricings[tierIndex] = { ...updatedPricings[tierIndex], price: prevPrice + 1 };
                        }
                    }

                    // 确保后面的元素都大于当前元素
                    for (let i = tierIndex + 1; i < updatedPricings.length; i++) {
                        const prevPrice = updatedPricings[i - 1].price;
                        if (updatedPricings[i].price <= prevPrice) {
                            updatedPricings[i] = { ...updatedPricings[i], price: prevPrice + 1 };
                        }
                    }
                }
            }

            setPricings(updatedPricings);
        }
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

        // 检查价格是否严格升序
        const prices = pricings.map(tier => tier.price);
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] <= prices[i - 1]) {
                showToast({ severity: 'error', summary: '错误', detail: '定价档位价格必须严格递增' });
                return;
            }
        }

        // 检查是否只有一个推荐项
        const recommendedCount = pricings.filter(tier => tier.is_recommend).length;
        if (recommendedCount > 1) {
            showToast({ severity: 'error', summary: '错误', detail: '只能有一个推荐档位' });
            return;
        }

        // 检查是否有AI订阅计划
        const aiPlanCount = pricings.filter(tier => tier.is_ai_plan).length;

        console.log('enter');

        // 如果没有AI订阅计划，提示用户是否将第一个计划设置为AI订阅计划
        if (aiPlanCount === 0) {
            confirmDialog({
                message: '当前没有设置AI订阅计划，是否需要将第一个计划自动设置为AI订阅计划？',
                header: '确认设置AI订阅计划',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: '是',
                rejectLabel: '否',
                accept: async () => {
                    // 用户选择是，将第一个计划设置为AI订阅计划
                    const updatedPricings = [...pricings];
                    updatedPricings[0] = { ...updatedPricings[0], is_ai_plan: true };
                    setPricings(updatedPricings);

                    setSaving(true);
                    try {
                        const result = await coachService.updatePricing({ pricings: updatedPricings });

                        if (result) {
                            showToast({ severity: 'success', summary: '成功', detail: '价格设置已保存，已将第一个计划设置为AI订阅计划' });
                        } else {
                            showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
                        }
                    } catch (error) {
                        showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
                    } finally {
                        setSaving(false);
                    }
                },
                reject: async () => {
                    // 用户选择否，继续保存但不设置AI计划
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
                }
            });

            return;
        } else {
            setSaving(true);
            const result = await coachService.updatePricing({ pricings });

            if (result) {
                showToast({ severity: 'success', summary: '成功', detail: '价格设置已保存，已将第一个计划设置为AI订阅计划' });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
            }

            setSaving(false);
        }
    };

    return (
        <>
            <ConfirmDialog />
            {loading ? (
                <div className="space-y-6">
                    {/* 标题区域骨架屏 */}
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton width="200px" height="32px" />
                        <Skeleton width="100px" height="36px" />
                    </div>

                    {/* 定价档位骨架屏 */}
                    {[1, 2, 3].map(item => (
                        <div key={item} className="p-4 border border-surface-200 rounded-xl bg-surface-50">
                            <div className="flex justify-between items-start mb-4">
                                <Skeleton width="100px" height="24px" />
                                {item > 1 && <Skeleton width="80px" height="32px" />}
                            </div>

                            <div className="mb-4">
                                <Skeleton width="100%" height="40px" className="mb-2" />
                                <Skeleton width="80px" height="20px" />
                            </div>

                            <div className="mb-4">
                                <Skeleton width="120px" height="24px" className="mb-2" />
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center mb-2">
                                        <Skeleton width="20px" height="20px" className="mr-2" />
                                        <Skeleton width={`${80 + i * 20}%`} height="36px" />
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center mb-2">
                                <Skeleton width="20px" height="20px" className="mr-2" />
                                <Skeleton width="120px" height="20px" />
                            </div>

                            <div className="flex items-center">
                                <Skeleton width="20px" height="20px" className="mr-2" />
                                <Skeleton width="150px" height="20px" />
                            </div>
                        </div>
                    ))}

                    {/* 规则说明骨架屏 */}
                    <div className="mt-8">
                        <Skeleton width="150px" height="24px" className="mb-4" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className="flex items-center">
                                    <Skeleton width="5px" height="5px" className="mr-2" />
                                    <Skeleton width={`${90 - i * 5}%`} height="18px" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 保存按钮骨架屏 */}
                    <div className="mt-6 flex justify-end">
                        <Skeleton width="100px" height="36px" />
                    </div>
                </div>
            ) : (
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
                                                className="p-4 border border-surface-200 rounded-xl bg-surface-50"
                                            >
                                                {/* 标题 + 删除按钮 */}
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="text-md font-medium">档位 {index + 1}</h4>

                                                    {pricings.length > 1 && (
                                                        <Button
                                                            icon="pi pi-times"
                                                            onClick={() => removeTier(tier.id!)}
                                                            className="p-button-rounded p-button-text p-button-secondary"
                                                            aria-label="删除"
                                                        />
                                                    )}
                                                </div>

                                                {/* 名称输入 */}
                                                <div className="mb-4">
                                                    <label className="block text-sm font-medium mb-2">名称</label>
                                                    <InputText
                                                        value={tier.title}
                                                        onChange={(e) => updateTier(tier.id!, 'title', e.target.value)}
                                                        placeholder="例如：基础版、专业版、企业版"
                                                        className="w-full"
                                                    />
                                                </div>

                                                {/* 价格输入 */}
                                                <div className="mb-4">
                                                    <label className="block text-sm font-medium mb-2">
                                                        价格（元/月）
                                                    </label>
                                                    <InputNumber
                                                        value={tier.price}
                                                        onValueChange={(e) => updateTier(tier.id!, 'price', e.value || 0)}
                                                        min={0}
                                                        mode="decimal"
                                                        minFractionDigits={2}
                                                        maxFractionDigits={2}
                                                        className="w-full"
                                                    />
                                                </div>

                                                {/* 特点列表 */}
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="block text-sm font-medium">特点</label>
                                                        <Button
                                                            icon="pi pi-plus"
                                                            onClick={() => addFeature(tier.id!)}
                                                            className="p-button-rounded p-button-text p-button-secondary"
                                                            aria-label="添加特点"
                                                        />
                                                    </div>

                                                    {tier.features.map((feature, featureIndex) => (
                                                        <div key={featureIndex} className="flex items-center mb-2">
                                                            <span className="pi pi-circle-fill text-xs mr-2 opacity-60" />
                                                            <InputText
                                                                value={feature}
                                                                onChange={(e) =>
                                                                    updateFeature(tier.id!, featureIndex, e.target.value)
                                                                }
                                                                placeholder="请输入该档位的一个特点"
                                                                className="flex-1"
                                                            />
                                                            {tier.features.length > 1 && (
                                                                <Button
                                                                    icon="pi pi-times"
                                                                    onClick={() => removeFeature(tier.id!, featureIndex)}
                                                                    className="p-button-rounded p-button-text p-button-secondary ml-2"
                                                                    aria-label="删除特点"
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 推荐 + AI计划 */}
                                                <div className="space-y-3">
                                                    {/* 推荐 */}
                                                    <div className="flex items-end">
                                                        <div className="flex items-center">
                                                            <Checkbox
                                                                inputId={`recommend-${index}`}
                                                                onChange={(e) =>
                                                                    updateTier(tier.id!, 'is_recommend', e.checked ?? false)
                                                                }
                                                                checked={tier.is_recommend}
                                                            />
                                                            <label htmlFor={`recommend-${index}`} className="ml-2 text-sm">
                                                                设置为推荐订阅
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* AI计划 */}
                                                    <div className="flex items-end">
                                                        <div className="flex items-center">
                                                            <Checkbox
                                                                inputId={`ai-${tier.id}`}
                                                                onChange={e => updateTier(tier.id!, 'is_ai_plan', e.checked ?? false)}
                                                                checked={tier.is_ai_plan}
                                                                disabled={index !== 0} // 只有第一个计划可以设置为AI订阅计划
                                                            />
                                                            <label htmlFor={`ai-${tier.id}`} className="ml-2 text-sm">
                                                                设置为AI订阅计划
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <Button
                                            label='保存'
                                            loading={saving}
                                            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                                            onClick={handleSave}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 右侧 - 规则说明 */}
                            <div>
                                <div className="bg-primary-50 dark:bg-primary-900 border border-primary-200 rounded-xl p-5 sticky top-20">
                                    <h3 className="font-semibold text-primary-800 dark:text-primary-50 mb-4">设置说明</h3>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-surface-600">
                                        <li>最多可以设置三个定价档位。</li>
                                        <li>每个档位必须有标题和价格。</li>
                                        <li>价格必须为正数。</li>
                                        <li>定价档位价格必须严格递增（每个档位价格必须高于前一个）。</li>
                                        <li>每个档位可以有多个特点描述。</li>
                                        <li>最多只能标记一个档位为"推荐"。</li>
                                        <li>最多只能标记一个档位为"AI订阅计划"，且只能设置在第一个档位。</li>
                                        <li>"我的主页"页面会显示此处设置的定价策略。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </>
    );
};

export default PricingSettings;