'use client';

import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import type { Product, PricingTier, DurationOption } from '@/app/api/coach/get-pricing/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';

interface PricingSettingsProps {
    coachId: string;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({ coachId }) => {
    // --- 核心逻辑状态 (完全保留) ---
    const [products, setProducts] = useState<Product[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [editDialog, setEditDialog] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
    const { showToast } = useToastContext();

    const tierConfig = {
        basic: { label: '特惠基础版', desc: '低价获客，适合自主训练', color: 'blue', icon: 'pi-bolt' },
        standard: { label: '专业指导版', desc: '核心服务，包含指导沟通', color: 'green', icon: 'pi-star' },
        vip: { label: '全能指导版', desc: '全方位托管，不限项目', color: 'purple', icon: 'pi-shield' }
    };

    const tierLabels = { basic: '特惠基础版', standard: '专业指导版', vip: '全能指导版' };
    const tierDescriptions = { basic: '低价获客，适合自主训练的学员', standard: '包含教练指导与沟通，核心服务', vip: '不限项目，全方位托管式服务' };

    useEffect(() => { loadPricing(); }, [coachId]);

    // --- 业务函数 (完全保留) ---
    const loadPricing = async () => {
        if (!coachId) { setLoading(false); return; }
        try {
            const res = await coachService.getPricing({ userId: coachId });
            if (res?.products) setProducts(res.products);
        } catch (error) {
            showToast({ severity: 'error', summary: '获取定价信息失败' });
        } finally { setLoading(false); }
    };

    const handleAddProduct = (tier: PricingTier) => {
        const newProduct: Product = {
            id: `prod_${Date.now()}`,
            tier,
            type: 'single',
            name: '',
            description: '',
            duration_options: [{ months: 1, price: 0 }]
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
        if (!currentProduct.name.trim()) { showToast({ severity: 'error', summary: '请输入产品名称' }); return; }
        if (currentProduct.duration_options.some(opt => opt.price <= 0)) { showToast({ severity: 'error', summary: '价格必须大于0' }); return; }
        
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
            if (result) showToast({ severity: 'success', summary: '定价设置已保存' });
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败' });
        } finally { setSaving(false); }
    };

    const handleAddDurationOption = () => {
        if (!currentProduct) return;
        setCurrentProduct({
            ...currentProduct,
            duration_options: [...currentProduct.duration_options, { months: 1, price: 0 }]
        });
    };

    const handleRemoveDurationOption = (index: number) => {
        if (!currentProduct || currentProduct.duration_options.length <= 1) return;
        const newOptions = [...currentProduct.duration_options];
        newOptions.splice(index, 1);
        setCurrentProduct({ ...currentProduct, duration_options: newOptions });
    };

    const updateDurationOption = (index: number, field: keyof DurationOption, value: any) => {
        if (!currentProduct) return;
        const newOptions = [...currentProduct.duration_options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        setCurrentProduct({ ...currentProduct, duration_options: newOptions });
    };

    // --- 渲染组件 ---

    const renderProductCard = (product: Product) => (
        <div key={product.id} className="group relative bg-white border border-surface-200 rounded-2xl p-5 hover:border-primary-400 hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-lg text-surface-900">{product.name}</h4>
                        {product.type === 'combo' && <Tag value="组合" severity="info" rounded className="text-[10px]" />}
                    </div>
                    <p className="text-sm text-surface-500 mb-4 line-clamp-2">{product.description || '暂无描述'}</p>
                    
                    <div className="flex flex-wrap gap-2">
                        {product.duration_options.map((opt, idx) => (
                            <div key={idx} className="bg-surface-50 border border-surface-100 px-3 py-1 rounded-lg flex items-center gap-2">
                                <span className="text-[10px] text-surface-400 font-bold uppercase">{opt.months}M</span>
                                <span className="text-sm font-bold text-primary">¥{opt.price}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button icon="pi pi-pencil" rounded text severity="secondary" size="small" onClick={() => handleEditProduct(product)} />
                    <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => handleDeleteProduct(product.id)} />
                </div>
            </div>
        </div>
    );

    const renderTierSection = (tier: PricingTier) => {
        const config = tierConfig[tier];
        const tierProducts = products.filter(p => p.tier === tier);

        return (
            <div className="mb-8">
                <div className="flex justify-between items-end mb-4 px-1">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-${config.color}-50 flex items-center justify-center text-${config.color}-500`}>
                            <i className={`pi ${config.icon} text-lg`}></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-surface-900">{tierLabels[tier]}</h3>
                            <p className="text-xs text-surface-400 font-medium">{tierDescriptions[tier]}</p>
                        </div>
                    </div>
                    <Button 
                        label="添加" 
                        icon="pi pi-plus" 
                        size="small" 
                        text 
                        onClick={() => handleAddProduct(tier)} 
                        className="font-bold rounded-lg"
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tierProducts.length === 0 ? (
                        <div className="md:col-span-2 py-8 border-2 border-dashed border-surface-100 rounded-2xl flex flex-col items-center justify-center bg-surface-50/50">
                            <span className="text-sm text-surface-400 italic">点击“添加”配置方案</span>
                        </div>
                    ) : (
                        tierProducts.map(renderProductCard)
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-4 space-y-4"><Skeleton height="150px" borderRadius="1rem" /><Skeleton height="150px" borderRadius="1rem" /></div>;

    return (
        <div className=" overflow-hidden">
            <div className="">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-surface-900 tracking-tight">服务方案定价</h2>
                        <p className="text-sm text-surface-400 font-medium">配置完成后点击右侧按钮发布至主页</p>
                    </div>
                    <Button 
                        label="更新定价" 
                        icon="pi pi-check-circle" 
                        loading={saving} 
                        disabled={saving}
                        onClick={handleSaveAll}
                        className="shadow-lg shadow-primary-200 rounded-xl px-6 py-3"
                    />
                </div>

                {renderTierSection('basic')}
                <Divider />
                {renderTierSection('standard')}
                <Divider />
                {renderTierSection('vip')}
            </div>

            <Dialog
                header={currentProduct?.id.startsWith('prod_') && products.some(p => p.id === currentProduct.id) ? "编辑方案" : "新建方案"}
                visible={editDialog}
                style={{ width: '95vw', maxWidth: '550px' }}
                onHide={() => { setEditDialog(false); setCurrentProduct(null); }}
                className="rounded-3xl"
                footer={
                    <div className="flex justify-end gap-2 p-3">
                        <Button label="取消" text severity="secondary" onClick={() => { setEditDialog(false); setCurrentProduct(null); }} />
                        <Button label="保存方案" className="px-6 rounded-xl" onClick={handleSaveProduct} />
                    </div>
                }
            >
                {currentProduct && (
                    <div className="space-y-5 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-surface-400 mb-2 ml-1">服务类型</label>
                                <Dropdown
                                    value={currentProduct.type}
                                    options={[{ label: '单项目', value: 'single' }, { label: '组合套餐', value: 'combo' }]}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, type: e.value })}
                                    className="w-full rounded-xl"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-surface-400 mb-2 ml-1">方案名称 *</label>
                                <InputText
                                    value={currentProduct.name}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                    className="w-full rounded-xl"
                                    placeholder="输入服务名称"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-surface-400 mb-2 ml-1">详细介绍</label>
                            <InputText
                                value={currentProduct.description || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                className="w-full rounded-xl"
                                placeholder="简单介绍该方案的特色"
                            />
                        </div>

                        {currentProduct.type === 'combo' && (
                            <div>
                                <label className="block text-xs font-bold text-surface-400 mb-2 ml-1">包含细项 (用逗号隔开)</label>
                                <InputText
                                    value={currentProduct.included_products?.join(', ') || ''}
                                    onChange={(e) => setCurrentProduct({
                                        ...currentProduct,
                                        included_products: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                    })}
                                    placeholder="项目1, 项目2"
                                    className="w-full rounded-xl"
                                />
                            </div>
                        )}

                        <div className="bg-surface-50 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold text-surface-700">时长梯度与价格</label>
                                <Button icon="pi pi-plus" label="增加梯度" size="small" text onClick={handleAddDurationOption} />
                            </div>
                            <div className="space-y-3">
                                {currentProduct.duration_options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-surface-100 shadow-sm">
                                        <AeroInputNumber
                                            value={opt.months}
                                            onValueChange={(e) => updateDurationOption(idx, 'months', e.value || 1)}
                                            min={1}
                                            suffix="个月"
                                            className="w-1/3"
                                            inputClassName="border-none w-full"
                                        />
                                        <AeroInputNumber
                                            value={opt.price}
                                            onValueChange={(e) => updateDurationOption(idx, 'price', e.value || 0)}
                                            min={0}
                                            mode="currency"
                                            currency="CNY"
                                            className="w-full"
                                            inputClassName="border-none font-bold"
                                        />
                                        {currentProduct.duration_options.length > 1 && (
                                            <Button icon="pi pi-times" text severity="danger" size="small" onClick={() => handleRemoveDurationOption(idx)} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default PricingSettings;