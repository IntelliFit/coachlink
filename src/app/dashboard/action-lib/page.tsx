'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { actionLibService } from '@/app/service/actionLibService';
import ActionEditDialog from './ActionEditDialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { CoachActionRow } from '@/types';
import ActionCard from './ActionCard';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

const ActionLib = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const { showToast } = useToastContext();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [searchResults, setSearchResults] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('pageId') || '1'));
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchTotalRecords, setSearchTotalRecords] = useState(0);
    const [editingAction, setEditingAction] = useState<CoachActionRow | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);

    const itemsPerPage = 12;

    // 逻辑：加载列表
    useEffect(() => {
        if (!coach?.id || searchTerm) return;
        loadActions();
    }, [coach?.id, currentPage]);

    const loadActions = async () => {

        setLoading(true);
        try {
            const res = await actionLibService.listActions({
                page: currentPage,
                limit: itemsPerPage
            });
            if (res) {
                setActions(res.actions);
                setTotalRecords(res.totalCount);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作列表' });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!coach?.id) return;
        setSearching(true);
        try {
            const res = await actionLibService.listActions({
                search: searchTerm || undefined,
                page: 1,
                limit: itemsPerPage
            });
            if (res) {
                setSearchResults(res.actions);
                setSearchTotalRecords(res.totalCount);
                setCurrentPage(1);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '搜索失败', detail: '无法搜索动作' });
        } finally {
            setSearching(false);
        }
    };

    const handleSaveAction = async (actionData: Partial<CoachActionRow>) => {
        try {
            if (editingAction) {
                await actionLibService.updateAction({ id: editingAction.id, ...actionData });
                showToast({ severity: 'success', summary: '更新成功', detail: '动作已更新' });
            } else {
                if (!coach?.id) return;
                await actionLibService.addAction({
                    name: actionData.name || '',
                    detail: actionData.detail || '',
                    url: actionData.url || '',
                    positions: actionData.positions || [],
                    attrs: actionData.attrs || [],
                    type: actionData.type,
                    enableAutoWeightCompute: actionData.enableAutoWeightCompute || false,
                    includesBodyWeight: actionData.includesBodyWeight || false,
                    item_schema: actionData.item_schema,
                    suggested_time: actionData.suggested_time,
                });
                showToast({ severity: 'success', summary: '添加成功', detail: '新动作已添加' });
            }
            setDialogVisible(false);
            searchTerm ? handleSearch() : loadActions();
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败', detail: '无法保存动作' });
        }
    };

    const handleEditAction = (action: CoachActionRow) => {
        setEditingAction(action);
        setDialogVisible(true);
    };

    const handleDeleteAction = (action: CoachActionRow) => {
        confirmDialog({
            message: `确定要删除动作"${action.name}"吗？此操作无法撤销。`,
            header: '确认删除',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await actionLibService.deleteAction({ id: action.id });
                    showToast({ severity: 'success', summary: '删除成功', detail: '动作已删除' });
                    searchTerm ? handleSearch() : loadActions();
                } catch (error) {
                    showToast({ severity: 'error', summary: '删除失败', detail: '无法删除动作' });
                }
            }
        });
    };

    const onPageChange = (event: { first: number; rows: number }) => {
        const newPage = Math.floor(event.first / event.rows) + 1;
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', newPage.toString());
        router.push(pathname + '?' + params.toString());

        setCurrentPage(newPage);
    };

    const renderActionCard = (action: CoachActionRow) => {
        return <ActionCard
            action={action}
            onEditAction={handleEditAction}
            onDeleteAction={handleDeleteAction}
        />
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <ConfirmDialog />
            <ActionEditDialog
                visible={dialogVisible}
                action={editingAction}
                onSave={handleSaveAction}
                onCancel={() => setDialogVisible(false)}
            />

            {/* Header: 数值中心化 */}
            <header className="flex items-center justify-between mb-10 px-2">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-surface-900">动作库管理</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-2 py-0.5 rounded">
                            {searchTerm ? searchTotalRecords : totalRecords} Actions
                        </span>
                        <span className="text-sm text-surface-500 font-medium">定制您的标准动作教学体系</span>
                    </div>
                </div>
                <Button label="添加动作" icon="pi pi-plus" onClick={() => { setEditingAction(null); setDialogVisible(true); }}
                    className="p-button-primary shadow-lg shadow-primary-100 rounded-2xl px-6 active:scale-95 transition-transform" />
            </header>

            {/* Search: 呼吸感交互 */}
            <section className="flex gap-3 mb-8 px-2">
                <IconField iconPosition="left" className="flex-1">
                    <InputIcon className="pi pi-search text-surface-400" />
                    <InputText
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (!e.target.value) {
                                setSearchResults([]);
                                setSearchTotalRecords(0);
                                setCurrentPage(1);
                                loadActions();
                            }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="搜索动作名称、描述或训练部位..."
                        className="w-full border-surface-200 bg-surface-50/50 focus:bg-white focus:border-primary rounded-2xl py-3 transition-all"
                    />
                </IconField>
                <Button icon="pi pi-search" onClick={handleSearch} loading={searching}
                    className="p-button-primary p-button-outlined rounded-2xl px-6 active:scale-95 transition-transform" />
            </section>

            <main>
                {loading || searching ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center gap-5 p-4 bg-white border border-surface-100 rounded-[20px]">
                                <Skeleton width="56px" height="56px" borderRadius="16px" />
                                <div className="flex-1"><Skeleton width="30%" className="mb-2" /><Skeleton width="60%" height="0.8rem" /></div>
                                <div className="flex gap-2"><Skeleton shape="circle" size="2rem" /><Skeleton shape="circle" size="2rem" /></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <DataView
                            lazy
                            value={searchTerm ? searchResults : actions}
                            itemTemplate={renderActionCard}
                            paginator
                            rows={itemsPerPage}
                            totalRecords={searchTerm ? searchTotalRecords : totalRecords}
                            onPage={onPageChange}
                            first={(currentPage - 1) * itemsPerPage}
                            className="bg-transparent"
                            pt={{
                                content: { className: 'bg-transparent border-none space-y-1' },
                                paginator: {
                                    pageButton: ({ context }) => ({
                                        className: context.active
                                            ? 'bg-primary text-white rounded-xl shadow-md shadow-primary-100'
                                            : 'text-surface-500 rounded-xl hover:bg-surface-100 transition-colors'
                                    })
                                }
                            }}
                        />
                        {(searchTerm ? searchResults : actions).length === 0 && (
                            <div className="text-center py-24 border-2 border-dashed border-surface-100 rounded-[32px]">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-50 text-surface-400 mb-4">
                                    <i className="pi pi-search text-xl" />
                                </div>
                                <h3 className="text-lg font-bold text-surface-900 tracking-tight">未找到相关动作</h3>
                                <p className="text-surface-500 text-sm mt-1">请尝试更换搜索关键词或添加新动作</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default ActionLib;