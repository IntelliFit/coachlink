'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { Dropdown } from 'primereact/dropdown';
import { useToastContext } from '@/context/ToastContext';
import { planLibService } from '@/app/service/planLibService';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { useRouter } from 'next/navigation';
import { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';

const PlanLib = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const router = useRouter();

    // 普通分页数据
    const [templates, setTemplates] = useState<CoachPlansPreview[]>([]);
    // 搜索结果数据
    const [searchResults, setSearchResults] = useState<CoachPlansPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [templateType, setTemplateType] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchTotalRecords, setSearchTotalRecords] = useState(0);

    const { showToast } = useToastContext();
    const itemsPerPage = 12;

    // 训练计划类型选项
    const templateTypes = [
        { label: '全部类型', value: 'all' },
        { label: '新手训练', value: 'beginner' },
        { label: '力量训练', value: 'strength' }
    ];

    // 加载训练计划模板列表
    useEffect(() => {
        if (!coach?.id) return;

        // 搜索模式下不加载普通列表
        if (searchTerm) return;

        loadTemplates();
    }, [coach?.id, currentPage, templateType]);

    const loadTemplates = async () => {
        if (!coach?.id) return;

        setLoading(true);
        try {
            const res = await planLibService.listTemplates({
                type: templateType || undefined,
                page: currentPage,
                limit: itemsPerPage
            });

            if (res) {
                setTemplates(res.templates);
                setTotalRecords(res.totalCount);
            }
        } catch (error) {
            console.error('加载训练计划模板列表失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载训练计划模板列表' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddPlan = () => {
        // 跳转到新建计划页面
        router.push('/dashboard/plan-lib/create');
    };

    const handleSearch = async () => {
        if (!coach?.id) return;

        setSearching(true);
        try {
            const res = await planLibService.listTemplates({
                search: searchTerm || undefined,
                type: templateType || undefined,
                page: 1, // 搜索时重置到第一页
                limit: itemsPerPage
            });

            if (res) {
                setSearchResults(res.templates);
                setSearchTotalRecords(res.totalCount);
                setCurrentPage(1); // 重置到第一页
            }
        } catch (error) {
            console.error('搜索训练计划模板失败:', error);
            showToast({ severity: 'error', summary: '搜索失败', detail: '无法搜索训练计划模板' });
        } finally {
            setSearching(false);
        }
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        setCurrentPage(newPage);
    };

    const renderTemplateCard = (template: CoachPlansPreview) => {
        return (
            <div className="border border-surface-200 rounded-lg p-4 hover:bg-surface-50 transition-colors">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-900 mb-2">{template.name}</h3>
                        <p className="text-600 mb-3 line-clamp-2">
                            {template.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mb-3">

                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                {Math.ceil((template.trainingDaysCount + template.restDaysCount) / 7)} 周训练
                            </span>
                            {/* 显示适用人群 */}
                            {template.suitableFor && (
                                <div className="">
                                    <span className="text-xs text-600">适用人群:</span>
                                    <span className="ml-1 text-sm text-900">{template.suitableFor}</span>
                                </div>
                            )}
                            {/* 显示标签 */}
                            {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {template.tags.map((tag, index) => (
                                        <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                        <Button
                            icon="pi pi-pencil"
                            className="p-button-rounded p-button-text"
                            tooltip="编辑"
                            onClick={() => router.push(`/dashboard/plan-lib/edit/${template.id}`)}
                        />
                    </div>
                </div>
            </div>
        );
    };


    // 确定当前应该显示的数据
    const getCurrentData = () => {
        if (searchTerm) {
            return searchResults;
        }
        return templates;
    };

    // 确定当前的总记录数
    const getCurrentTotalRecords = () => {
        if (searchTerm) {
            return searchTotalRecords;
        }
        return totalRecords;
    };

    // 确定是否应该显示骨架屏
    const shouldShowSkeleton = () => {
        // 初始加载或搜索时显示骨架屏
        return loading || searching;
    };

    return (
        <div className="mx-auto">
            <Card className="shadow-sm">
                {/* 顶部区域 - 始终显示搜索框 */}
                <div className="border-b border-surface-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">训练计划模板库</h1>
                            <p className="text-600 mt-1">管理您的训练计划模板</p>
                        </div>
                        <Button
                            label="新建模板"
                            icon="pi pi-plus"
                            onClick={handleAddPlan}
                        />
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mt-6">
                        <div className="flex-1">
                            <IconField iconPosition="left" className='w-full'>
                                <InputIcon className="pi pi-search" />
                                <InputText
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        // 如果搜索词为空，重新加载普通数据
                                        if (!e.target.value) {
                                            setCurrentPage(1);
                                            loadTemplates();
                                        }
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="搜索训练计划模板名称或描述..."
                                    className="w-full"
                                />
                            </IconField>
                        </div>
                        <div className="flex gap-2">
                            <Dropdown
                                value={templateType}
                                options={templateTypes}
                                onChange={(e) => setTemplateType(e.value)}
                                placeholder="训练类型"
                                className="w-full md:w-40"
                            />
                            <Button
                                label="搜索"
                                icon="pi pi-search"
                                onClick={handleSearch}
                            />
                        </div>
                    </div>
                </div>

                {/* 训练计划模板列表区域 */}
                <div className="p-4 md:p-6">
                    {shouldShowSkeleton() ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="border rounded-lg p-4">
                                    <Skeleton width="100%" height="1.5rem" className="mb-3" />
                                    <Skeleton width="80%" height="1rem" className="mb-2" />
                                    <Skeleton width="60%" height="1rem" className="mb-4" />
                                    <div className="flex justify-between">
                                        <Skeleton width="3rem" height="1.5rem" />
                                        <div className="flex gap-1">
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                            <Skeleton width="2rem" height="2rem" shape="circle" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : getCurrentData().length === 0 && !searchTerm && !templateType ? (
                        <div className="text-center py-12">
                            <h3 className="text-lg font-semibold text-900 mb-2">暂无训练计划模板</h3>
                            <p className="text-600 mb-6">开始创建您的第一个训练计划模板</p>
                            <Button
                                label="新建模板"
                                icon="pi pi-plus"
                                onClick={handleAddPlan}
                            />
                        </div>
                    ) : (
                        <>
                            <DataView
                                value={getCurrentData()}
                                itemTemplate={renderTemplateCard}
                                paginator
                                rows={itemsPerPage}
                                totalRecords={getCurrentTotalRecords()}
                                first={searchTerm ? 0 : (currentPage - 1) * itemsPerPage}
                                onPage={onPageChange}
                                emptyMessage="未找到匹配的训练计划模板"
                            />
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PlanLib;