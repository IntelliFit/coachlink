'use client';

import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { TabView, TabPanel } from 'primereact/tabview';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import type { Product, PricingTier, ProductType, DurationOption } from '@/app/api/coach/get-pricing/entity';

interface PricingSettingsProps {
    coachId: string;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({ coachId }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [editDialog, setEditDialog] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
    const { showToast } = useToastContext();

    const tierLabels = {
        basic: '特惠基础版',
        standard: '专业指导版',
        vip: '全能指导版'
    };

    const tierDescriptions = {
        basic: '低价获客，适合自主训练的学员',
        standard: '包含教练指导与沟通，核心服务',
        vip: '不限项目，全方位托管式服务'
    };

    useEffect(() => {
        loadPricing();
    }, [coachId]);

    const loadPricing = async () => {
        if (!coachId) {
            setLoading(false);
            return;
        }

        try {
            const res = await coachService.getPricing({ userId: coachId });
            if (res?.products) {
                setProducts(res.products);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '获取定价信息失败' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddProduct = (tier: PricingTier) => {
        const newProduct: Product = {
            id: `prod_${Date.now()}`,
            tier,
            type: 'single',
            name: '',
            description: '',
            duration_options: [
                { months: 1, price: 0 }
            ]
        };
        setCurrentProduct(newProduct);
        setEditDialog(true);
    };

    const handleEditProduct = (product: Product) => {
        setCurrentProduct({ ...product });
        setEditDialog(true);
    };

    const handleDeleteProduct = (productId: string) => {
        setProducts(products.filter(p => p.id !== productId));
        showToast({ severity: 'success', summary: '已删除产品' });
    };

    const handleSaveProduct = () => {
        if (!currentProduct) return;

        // 验证
        if (!currentProduct.name.trim()) {
            showToast({ severity: 'error', summary: '请输入产品名称' });
            return;
        }

        if (currentProduct.duration_options.some(opt => opt.price <= 0)) {
            showToast({ severity: 'error', summary: '价格必须大于0' });
            return;
        }

        // 如果是组合套餐，检查是否有包含项
        if (currentProduct.type === 'combo' && (!currentProduct.included_products || currentProduct.included_products.length === 0)) {
            showToast({ severity: 'error', summary: '组合套餐至少需要包含一个项目' });
            return;
        }

        // 更新或添加
        const existingIndex = products.findIndex(p => p.id === currentProduct.id);
        if (existingIndex >= 0) {
            const newProducts = [...products];
            newProducts[existingIndex] = currentProduct;
            setProducts(newProducts);
        } else {
            setProducts([...products, currentProduct]);
        }

        setEditDialog(false);
        setCurrentProduct(null);
        showToast({ severity: 'success', summary: '产品已保存' });
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const result = await coachService.updatePricing({ products });
            if (result) {
                showToast({ severity: 'success', summary: '定价设置已保存' });
            } else {
                showToast({ severity: 'error', summary: '保存失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddDurationOption = () => {
        if (!currentProduct) return;
        const newOption: DurationOption = { months: 1, price: 0 };
        setCurrentProduct({
            ...currentProduct,
            duration_options: [...currentProduct.duration_options, newOption]
        });
    };

    const handleRemoveDurationOption = (index: number) => {
        if (!currentProduct || currentProduct.duration_options.length <= 1) return;
        const newOptions = [...currentProduct.duration_options];
        newOptions.splice(index, 1);
        setCurrentProduct({
            ...currentProduct,
            duration_options: newOptions
        });
    };

    const updateDurationOption = (index: number, field: keyof DurationOption, value: any) => {
        if (!currentProduct) return;
        const newOptions = [...currentProduct.duration_options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        setCurrentProduct({
            ...currentProduct,
            duration_options: newOptions
        });
    };

    const getProductsByTier = (tier: PricingTier) => {
        return products.filter(p => p.tier === tier);
    };

    const renderProductCard = (product: Product) => (
        <Card key={product.id} className="mb-3">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-1">{product.name}</h4>
                    <p className="text-sm text-surface-600 mb-2">{product.description}</p>
                    <div className="text-sm">
                        {product.type === 'combo' && product.included_products && (
                            <div className="mb-2 text-surface-500">
                                包含: {product.included_products.join(' + ')}
                            </div>
                        )}
                        <div className="flex gap-3">
                            {product.duration_options.map((opt, idx) => (
                                <span key={idx} className="font-medium">
                                    {opt.months}个月: ¥{opt.price}
                                    {opt.is_recommend && <span className="text-primary ml-1">⭐</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        icon="pi pi-pencil"
                        className="p-button-text p-button-sm"
                        onClick={() => handleEditProduct(product)}
                    />
                    <Button
                        icon="pi pi-trash"
                        className="p-button-text p-button-danger p-button-sm"
                        onClick={() => handleDeleteProduct(product.id)}
                    />
                </div>
            </div>
        </Card>
    );

    const renderTierSection = (tier: PricingTier) => {
        const tierProducts = getProductsByTier(tier);
        return (
            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h3 className="text-xl font-bold">{tierLabels[tier]}</h3>
                        <p className="text-sm text-surface-500">{tierDescriptions[tier]}</p>
                    </div>
                    <Button
                        label="添加产品"
                        icon="pi pi-plus"
                        onClick={() => handleAddProduct(tier)}
                        className="p-button-sm"
                    />
                </div>
                {tierProducts.length === 0 ? (
                    <div className="text-center py-8 text-surface-500 border-2 border-dashed border-surface-300 rounded-lg">
                        暂无产品，点击上方按钮添加
                    </div>
                ) : (
                    tierProducts.map(renderProductCard)
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <Card>
                <div className="p-6 space-y-6">
                    <Skeleton width="200px" height="32px" />
                    <Skeleton width="100%" height="100px" />
                    <Skeleton width="100%" height="100px" />
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">订阅定价设置</h2>
                        <Button
                            label="保存所有更改"
                            icon="pi pi-save"
                            onClick={handleSaveAll}
                            loading={saving}
                            disabled={saving}
                        />
                    </div>

                    {renderTierSection('basic')}
                    {renderTierSection('standard')}
                    {renderTierSection('vip')}
                </div>
            </Card>

            {/* 编辑产品对话框 */}
            <Dialog
                header={currentProduct?.id.startsWith('prod_') && products.some(p => p.id === currentProduct.id) ? "编辑产品" : "添加产品"}
                visible={editDialog}
                style={{ width: '600px' }}
                onHide={() => {
                    setEditDialog(false);
                    setCurrentProduct(null);
                }}
            >
                {currentProduct && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">产品类型</label>
                            <Dropdown
                                value={currentProduct.type}
                                options={[
                                    { label: '单项目', value: 'single' },
                                    { label: '组合套餐', value: 'combo' }
                                ]}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, type: e.value })}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">产品名称 *</label>
                            <InputText
                                value={currentProduct.name}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                placeholder="如：引体向上训练"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">描述</label>
                            <InputText
                                value={currentProduct.description || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                placeholder="产品简介"
                                className="w-full"
                            />
                        </div>

                        {currentProduct.type === 'combo' && (
                            <div>
                                <label className="block text-sm font-medium mb-2">包含项目 (逗号分隔)</label>
                                <InputText
                                    value={currentProduct.included_products?.join(', ') || ''}
                                    onChange={(e) => setCurrentProduct({
                                        ...currentProduct,
                                        included_products: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                    })}
                                    placeholder="如：引体向上, 卧推"
                                    className="w-full"
                                />
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium">时长定价 *</label>
                                <Button
                                    icon="pi pi-plus"
                                    label="添加时长"
                                    className="p-button-sm p-button-text"
                                    onClick={handleAddDurationOption}
                                />
                            </div>
                            {currentProduct.duration_options.map((opt, idx) => (
                                <div key={idx} className="flex gap-2 items-center mb-2">
                                    <InputNumber
                                        value={opt.months}
                                        onValueChange={(e) => updateDurationOption(idx, 'months', e.value || 1)}
                                        min={1}
                                        suffix=" 个月"
                                        className="flex-1"
                                    />
                                    <InputNumber
                                        value={opt.price}
                                        onValueChange={(e) => updateDurationOption(idx, 'price', e.value || 0)}
                                        min={0}
                                        mode="currency"
                                        currency="CNY"
                                        locale="zh-CN"
                                        className="flex-1"
                                    />
                                    {currentProduct.duration_options.length > 1 && (
                                        <Button
                                            icon="pi pi-trash"
                                            className="p-button-danger p-button-text"
                                            onClick={() => handleRemoveDurationOption(idx)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                label="取消"
                                className="p-button-text"
                                onClick={() => {
                                    setEditDialog(false);
                                    setCurrentProduct(null);
                                }}
                            />
                            <Button
                                label="保存"
                                onClick={handleSaveProduct}
                            />
                        </div>
                    </div>
                )}
            </Dialog>
        </>
    );
};

export default PricingSettings;