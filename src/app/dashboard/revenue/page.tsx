'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    ArrowLeft, TrendingUp, Users, FileText, 
    Calendar as CalendarIcon, Loader2 
} from 'lucide-react';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Calendar } from 'primereact/calendar';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { coachService } from '@/app/service/coachService';
import type { RevenueItem } from '@/app/api/coach/get-revenue-details/entity';

export default function RevenuePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
    const [items, setItems] = useState<RevenueItem[]>([]);
    const [subscriptionRevenue, setSubscriptionRevenue] = useState(0);
    const [contentPurchaseRevenue, setContentPurchaseRevenue] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);

    const formatMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const loadData = async (month: string) => {
        setLoading(true);
        try {
            const data = await coachService.getRevenueDetails({ month });
            if (data) {
                setItems(data.items || []);
                setSubscriptionRevenue(data.subscriptionRevenue || 0);
                setContentPurchaseRevenue(data.contentPurchaseRevenue || 0);
                setTotalRevenue(data.totalRevenue || 0);
            }
        } catch (error) {
            console.error('加载收入明细失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(formatMonth(selectedMonth));
    }, [selectedMonth]);

    // 格式化金额（已经是元，直接显示）
    const formatAmount = (yuan: number) => {
        return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // 格式化日期
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('zh-CN', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // 表格列渲染
    const typeTemplate = (rowData: RevenueItem) => (
        <Tag 
            value={rowData.type === 'subscription' ? '订阅' : '文章'} 
            severity={rowData.type === 'subscription' ? 'info' : 'success'}
            className="text-xs"
        />
    );

    const amountTemplate = (rowData: RevenueItem) => (
        <span className="font-mono font-semibold text-green-600">
            +{formatAmount(rowData.amount)}
        </span>
    );

    const dateTemplate = (rowData: RevenueItem) => (
        <span className="text-surface-500 text-sm">
            {formatDate(rowData.createdAt)}
        </span>
    );

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto">
            {/* 头部 */}
            <div className="flex items-center gap-4">
                <Button 
                    icon={<ArrowLeft className="w-4 h-4" />}
                    className="p-button-text p-button-rounded"
                    onClick={() => router.push('/dashboard/overview')}
                />
                <div>
                    <h1 className="text-xl font-black text-surface-900">收入明细</h1>
                    <p className="text-sm text-surface-500">查看订阅与内容购买的详细流水</p>
                </div>
            </div>

            {/* 月份选择器 */}
            <div className="flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-surface-400" />
                <Calendar 
                    value={selectedMonth}
                    onChange={(e) => e.value && setSelectedMonth(e.value as Date)}
                    view="month"
                    dateFormat="yy年mm月"
                    className="w-40"
                    maxDate={new Date()}
                />
            </div>

            {/* 收入汇总卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 总收入 */}
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-200" />
                        <span className="text-purple-100 text-sm font-medium">本月总收入</span>
                    </div>
                    {loading ? (
                        <Skeleton width="8rem" height="2rem" className="!bg-purple-400/30" />
                    ) : (
                        <div className="text-3xl font-black font-mono">
                            {formatAmount(totalRevenue)}
                        </div>
                    )}
                </div>

                {/* 订阅收入 */}
                <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-surface-500 text-sm">订阅收入</span>
                    </div>
                    {loading ? (
                        <Skeleton width="6rem" height="1.5rem" />
                    ) : (
                        <div className="text-xl font-bold text-surface-900 font-mono">
                            {formatAmount(subscriptionRevenue)}
                        </div>
                    )}
                </div>

                {/* 内容购买收入 */}
                <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        <span className="text-surface-500 text-sm">文章购买收入</span>
                    </div>
                    {loading ? (
                        <Skeleton width="6rem" height="1.5rem" />
                    ) : (
                        <div className="text-xl font-bold text-surface-900 font-mono">
                            {formatAmount(contentPurchaseRevenue)}
                        </div>
                    )}
                </div>
            </div>

            {/* 流水列表 */}
            <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-surface-100">
                    <h2 className="font-bold text-surface-900">收入流水</h2>
                </div>
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-12 text-center text-surface-400">
                        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-surface-200" />
                        <p>本月暂无收入记录</p>
                    </div>
                ) : (
                    <DataTable 
                        value={items} 
                        paginator 
                        rows={10}
                        rowsPerPageOptions={[10, 20, 50]}
                        className="p-datatable-sm"
                        emptyMessage="暂无数据"
                    >
                        <Column field="type" header="类型" body={typeTemplate} style={{ width: '80px' }} />
                        <Column field="description" header="描述" />
                        <Column field="studentName" header="来源" style={{ width: '120px' }} />
                        <Column field="amount" header="金额" body={amountTemplate} style={{ width: '120px' }} />
                        <Column field="createdAt" header="时间" body={dateTemplate} style={{ width: '140px' }} />
                    </DataTable>
                )}
            </div>
        </div>
    );
}
