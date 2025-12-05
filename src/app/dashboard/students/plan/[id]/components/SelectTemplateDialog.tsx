'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Paginator } from 'primereact/paginator';
import { Tag } from 'primereact/tag';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';
import type { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';
import type { GetTemplateResponseDto } from '@/app/api/plan-lib/get-template/entity';

interface SelectTemplateDialogProps {
    visible: boolean;
    onHide: () => void;
    onSelectTemplate: (template: GetTemplateResponseDto) => void;
    coachId: string;
}

const SelectTemplateDialog: React.FC<SelectTemplateDialogProps> = ({
    visible,
    onHide,
    onSelectTemplate,
    coachId
}) => {
    const { showToast } = useToastContext();
    const [templates, setTemplates] = useState<CoachPlansPreview[]>([]);
    const [loading, setLoading] = useState(false);
    const [first, setFirst] = useState(0);
    const [rows] = useState(5);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (visible && coachId) {
            loadTemplates(currentPage);
        }
    }, [visible, coachId, currentPage]);

    const loadTemplates = async (page: number) => {
        if (!coachId) return;

        setLoading(true);
        try {
            const response = await planLibService.listTemplates({
                page: page,
                limit: rows
            });

            if (response) {
                setTemplates(response.templates);
                setTotalRecords(response.totalCount);
            }
        } catch (error) {
            console.error('加载模板失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载训练计划模板' });
            setTemplates([]);
            setTotalRecords(0);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (event: any) => {
        setFirst(event.first);
        setCurrentPage(event.page + 1);
    };

    const handleSelect = async (template: CoachPlansPreview) => {
        try {
            const templateDetails = await planLibService.getTemplate({ id: template.id });
            onSelectTemplate(templateDetails);
            onHide();
        } catch (error) {
            console.error('获取模板详情失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载模板详情' });
        }
    };

    const renderTags = (tags: string[]) => {
        return tags.map((tag, index) => (
            <Tag key={index} value={tag} className="mr-2 mb-2" />
        ));
    };

    const renderSkeleton = () => {
        return Array.from({ length: rows }).map((_, index) => (
            <div
                key={index}
                className="grid grid-cols-5 gap-3 border-b py-3 items-center"
                style={{ minHeight: '48px' }} // 与 DataTable 行高一致
            >
                {/* 模板名称（20%） */}
                <Skeleton height="1.2rem" width="80%" />

                {/* 描述（30%） */}
                <Skeleton height="1.2rem" width="90%" />

                {/* 标签（25%）固定高度避免跳动 */}
                <div className="flex flex-wrap" style={{ minHeight: '1.5rem' }}>
                    <Skeleton height="1.5rem" width="40%" className="mr-2" />
                    <Skeleton height="1.5rem" width="30%" />
                </div>

                {/* 训练天数（15%） */}
                <Skeleton height="1.2rem" width="70%" />

                {/* 操作按钮（10%） */}
                <Skeleton height="2rem" width="60%" />
            </div>
        ));
    };

    const footer = (
        <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text" />
    );

    return (
        <Dialog
            header="选择训练计划模板"
            visible={visible}
            onHide={onHide}
            footer={footer}
            maximizable
            breakpoints={{
                '960px': '95vw',
                '1280px': '80vw'
            }}
            style={{ width: '70vw' }}
        >
            {loading ? (
                <div>{renderSkeleton()}</div>
            ) : (
                <>
                    <DataTable
                        value={templates}
                        emptyMessage="没有找到训练计划模板"
                        tableStyle={{ minWidth: '40rem' }}
                    >
                        <Column
                            field="name"
                            header="模板名称"
                            style={{ width: '20%' }}
                        ></Column>
                        <Column
                            field="description"
                            header="描述"
                            body={(rowData) => (
                                <span>{rowData.description || '无描述'}</span>
                            )}
                        ></Column>
                        <Column
                            field="tags"
                            header="标签"
                            body={(rowData) => renderTags(rowData.tags)}
                        ></Column>
                        <Column
                            field="trainingDaysCount"
                            header="训练天数"
                            body={(rowData) => (
                                <span>{rowData.trainingDaysCount}天训练/{rowData.restDaysCount}天休息</span>
                            )}
                        ></Column>
                        <Column
                            header="操作"
                            body={(rowData) => (
                                <Button
                                    icon="pi pi-check"
                                    label="选择"
                                    onClick={() => handleSelect(rowData)}
                                    className="p-button-sm"
                                />
                            )}
                        ></Column>
                    </DataTable>

                    {totalRecords > rows && (
                        <Paginator
                            first={first}
                            rows={rows}
                            totalRecords={totalRecords}
                            onPageChange={handlePageChange}
                            className="mt-3"
                        />
                    )}
                </>
            )}
        </Dialog>
    );
};

export default SelectTemplateDialog;