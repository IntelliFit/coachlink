'use client';

import React, { useEffect, useState } from 'react';
// 1. 引入 addLocale 和 locale 方法
import { addLocale, locale } from 'primereact/api';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardTemplateRow } from '@/types';

interface EditLeaderboardFormProps {
    leaderboard: LeaderboardTemplateRow | null;
    visible: boolean;
    onHide: () => void;
    onSuccess: () => void;
}

// 2. 定义中文配置
addLocale('zh-CN', {
    firstDayOfWeek: 1,
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
    today: '今天',
    clear: '清除'
});

export default function EditLeaderboardForm({ leaderboard, visible, onHide, onSuccess }: EditLeaderboardFormProps) {
    const { showToast } = useToastContext();

    // ... formData 和 submitting 状态保持不变 ...

    const [formData, setFormData] = useState({
        id: '',
        title: '',
        description: '',
        start_at: null as Date | null,
        end_at: null as Date | null,
        rank_by_field: '',
        sort_order: 'desc',
        type: 'score',
        remarks: ''
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (leaderboard) {
            setFormData({
                id: leaderboard.id,
                title: leaderboard.title || '',
                description: leaderboard.description || '',
                start_at: leaderboard.start_at ? new Date(leaderboard.start_at) : null,
                end_at: leaderboard.end_at ? new Date(leaderboard.end_at) : null,
                rank_by_field: leaderboard.rank_by_field || '',
                sort_order: leaderboard.sort_order || 'desc',
                type: leaderboard.type || 'score',
                remarks: leaderboard.remarks || ''
            });
        }
    }, [leaderboard]);

    const handleSubmit = async () => {
        if (!formData.title || !formData.rank_by_field) {
            showToast({ severity: 'warn', summary: '提示', detail: '请填写必填项' });
            return;
        }

        setSubmitting(true);
        try {
            const reqData = {
                ...formData,
                start_at: formData.start_at?.toISOString(),
                end_at: formData.end_at?.toISOString()
            };
            const result = await rankingService.updateLeaderboard(reqData);
            if (result?.success) {
                showToast({ severity: 'success', summary: '成功', detail: '更新成功' });
                onSuccess();
                onHide();
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '更新失败' });
        } finally {
            setSubmitting(false);
        }
    };

    const renderFooter = () => (
        <div className="flex justify-end gap-2">
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text p-button-secondary" />
            <Button label="保存更改" icon="pi pi-check" loading={submitting} onClick={handleSubmit} autoFocus />
        </div>
    );

    if (!leaderboard) return null;

    return (
        <Dialog
            header="编辑排行榜"
            visible={visible}
            onHide={onHide}
            footer={renderFooter()}
            style={{ width: '700px' }}
            breakpoints={{ '960px': '75vw', '641px': '100vw' }}
            modal
            className="p-fluid"
        >
            <div className="pt-2">
                <div className="grid">
                    {/* 其他字段保持不变... */}
                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">标题 *</label>
                        <InputText name="title" value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">排名字段 *</label>
                        <InputText name="rank_by_field" value={formData.rank_by_field} onChange={(e) => setFormData(p => ({ ...p, rank_by_field: e.target.value }))} />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label htmlFor="start_at" className="font-bold block mb-2">开始时间</label>
                        <Calendar
                            id="start_at"
                            value={formData.start_at}
                            onChange={(e) => setFormData(p => ({ ...p, start_at: e.value as Date }))}
                            showTime
                            hourFormat="24"
                            showIcon
                            // 3. 应用中文语言包
                            locale="zh-CN"
                            dateFormat="yy-mm-dd"
                            placeholder="选择开始时间"
                        />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label htmlFor="end_at" className="font-bold block mb-2">结束时间</label>
                        <Calendar
                            id="end_at"
                            value={formData.end_at}
                            onChange={(e) => setFormData(p => ({ ...p, end_at: e.value as Date }))}
                            showTime
                            hourFormat="24"
                            showIcon
                            // 3. 应用中文语言包
                            locale="zh-CN"
                            dateFormat="yy-mm-dd"
                            placeholder="选择结束时间"
                        />
                    </div>

                    {/* 其他下拉框和备注... */}
                    <div className="col-12 field mb-4">
                        <label className="font-bold block mb-2">描述</label>
                        <InputTextarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}