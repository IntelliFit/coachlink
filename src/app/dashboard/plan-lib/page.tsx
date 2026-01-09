'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { useToastContext } from '@/context/ToastContext';
import { planLibService } from '@/app/service/planLibService';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { useRouter } from 'next/navigation';
import { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';
import TemplateCard from './components/TemplateCard';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

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

    const handleCopyTemplate = async (id: string) => {
        try {
            await planLibService.copyTemplate({ id });
            showToast({ severity: 'success', summary: '复制成功', detail: '训练计划模板已复制' });
            // 重新加载列表
            if (searchTerm) {
                handleSearch();
            } else {
                loadTemplates();
            }
        } catch (error) {
            console.error('复制训练计划模板失败:', error);
            showToast({ severity: 'error', summary: '复制失败', detail: '无法复制训练计划模板' });
        }
    };

    const handleDeleteTemplate = (id: string) => {
        confirmDialog({
            message: '确定要删除这个训练计划模板吗？此操作无法撤销。',
            header: '确认删除',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '确认',
            rejectLabel: '取消',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await planLibService.deleteTemplate({ id });
                    showToast({ severity: 'success', summary: '删除成功', detail: '训练计划模板已删除' });
                    // 重新加载列表
                    if (searchTerm) {
                        handleSearch();
                    } else {
                        loadTemplates();
                    }
                } catch (error) {
                    console.error('删除训练计划模板失败:', error);
                    showToast({ severity: 'error', summary: '删除失败', detail: '无法删除训练计划模板' });
                }
            }
        });
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
            <TemplateCard
                template={template}
                onEdit={(id) => router.push(`/dashboard/plan-lib/edit/${id}`)}
                onCopy={handleCopyTemplate}
                onDelete={handleDeleteTemplate}
            />
        );
    };

    // 确定是否应该显示骨架屏
    const shouldShowSkeleton = () => {
        // 初始加载或搜索时显示骨架屏
        return loading || searching;
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <ConfirmDialog />

            {/* Header: 强调数值中心化 */}
            <header className="flex items-center justify-between mb-12 px-2">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-surface-900">
                        计划模板库
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-2 py-0.5 rounded">
                            {totalRecords} Templates
                        </span>
                        <span className="text-sm text-surface-500 font-medium">沉淀高效训练体系</span>
                    </div>
                </div>

                <Button
                    label="新建模板"
                    icon="pi pi-plus"
                    onClick={handleAddPlan}
                    className="p-button-primary shadow-lg shadow-primary-200 transition-transform active:scale-95 rounded-2xl px-6"
                />
            </header>

            {/* Search: 呼吸感边框与 Primary 联动 */}
            <section className="flex gap-3 mb-10 px-2">
                <IconField iconPosition="left" className="flex-1">
                    <InputIcon className="pi pi-search text-surface-400" />
                    <InputText
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (!e.target.value) { setCurrentPage(1); loadTemplates(); }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="搜索模板名称或描述..."
                        className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-3 transition-all"
                    />
                </IconField>
                <Button
                    icon="pi pi-search"
                    onClick={handleSearch}
                    loading={searching}
                    className="p-button-primary p-button-outlined rounded-2xl px-6 active:scale-95 transition-transform"
                />
            </section>

            {/* List Content: 极简层级代替沉重线条 */}
            <main>
                {shouldShowSkeleton() ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col md:flex-row items-center gap-6 p-5 bg-surface dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-[20px]">

                                {/* 左侧：核心数值占位 (对齐 72x72 尺寸) */}
                                <div className="flex flex-col items-center justify-center min-w-[72px] h-[72px] bg-surface-50 dark:bg-surface-800/50 rounded-[18px]">
                                    <Skeleton width="1.5rem" height="1.5rem" className="mb-2" />
                                    <Skeleton width="2rem" height="0.6rem" />
                                </div>

                                {/* 中间：信息排版占位 */}
                                <div className="flex-1 min-w-0 w-full">
                                    {/* 标题占位 */}
                                    <Skeleton width="40%" height="1.25rem" className="mb-3" />

                                    {/* 描述占位 */}
                                    <Skeleton width="80%" height="0.8rem" className="mb-4" />

                                    {/* 标签组占位：模拟多个胶囊标签 */}
                                    <div className="flex gap-2">
                                        <Skeleton width="4rem" height="1.5rem" borderRadius="12px" />
                                        <Skeleton width="3rem" height="1.5rem" borderRadius="12px" />
                                        <Skeleton width="5rem" height="1.5rem" borderRadius="12px" />
                                    </div>
                                </div>

                                {/* 右侧：操作区占位 (对应 Hover 时才会出现的按钮空间) */}
                                <div className="hidden md:flex items-center gap-2">
                                    <Skeleton shape="circle" size="2rem" />
                                    <Skeleton shape="circle" size="2rem" />
                                    <Skeleton shape="circle" size="2rem" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <DataView
                        lazy
                        value={searchTerm ? searchResults : templates}
                        itemTemplate={renderTemplateCard}
                        paginator
                        rows={itemsPerPage}
                        totalRecords={searchTerm ? searchTotalRecords : totalRecords}
                        first={searchTerm ? 0 : (currentPage - 1) * itemsPerPage}
                        onPage={onPageChange}
                        className="bg-transparent"
                        pt={{
                            // 强制列表模式，确保一行一个
                            content: { className: 'bg-transparent border-none space-y-3' },
                            paginator: {
                                pageButton: ({ context }) => ({
                                    className: context.active
                                        ? 'bg-primary text-surface rounded-xl shadow-md shadow-primary-100'
                                        : 'text-surface-500 rounded-xl hover:bg-surface-100'
                                })
                            }
                        }}
                    />
                )}

                {!loading && (searchTerm ? searchResults : templates).length === 0 && (
                    <div className="text-center py-32 border-2 border-dashed border-surface-100 rounded-[32px]">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 text-primary mb-4">
                            <i className="pi pi-folder-open text-2xl" />
                        </div>
                        <h3 className="text-lg font-bold text-surface-900 tracking-tight">未找到匹配项</h3>
                        <p className="text-surface-500 text-sm mt-1">请尝试调整搜索词或过滤器</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PlanLib;