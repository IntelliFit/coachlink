'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Info, Scale, Gift } from 'lucide-react';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { useSession } from 'next-auth/react';
import { rankingService } from '@/app/service/rankingService';

export default function PullupLeaderboardPage() {
    const { data: session } = useSession();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        weight_kg: 0,
        video_url: '',
        notes: '',
    });
    const toast = React.useRef<Toast>(null);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    async function loadLeaderboard() {
        try {
            setLoading(true);
            const res = await rankingService.getLeaderboard({ leaderboardType: 'pullup' });
            if (res) {
                setRecords(res.data || []);
            }
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: '加载失败',
                detail: '请稍后重试',
            });
        } finally {
            setLoading(false);
        }
    }

    const rankBodyTemplate = (rowData: any, { rowIndex }: any) => {
        const rank = rowIndex + 1;
        return (
            <span
                className={`font-bold ${rank === 1
                        ? 'text-yellow-500'
                        : rank === 2
                            ? 'text-gray-400'
                            : rank === 3
                                ? 'text-amber-600'
                                : 'text-gray-700 dark:text-gray-300'
                    }`}
            >
                {rank}
            </span>
        );
    };

    const genderTemplate = (rowData: any) =>
        rowData.gender === 'male' ? '男' : rowData.gender === 'female' ? '女' : '-';

    const videoTemplate = (rowData: any) =>
        rowData.video_url ? (
            <a
                href={rowData.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
            >
                查看
            </a>
        ) : (
            '-'
        );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await rankingService.submitRecord('pullup', {

            });

            if (res) {
                toast.current?.show({
                    severity: 'success',
                    summary: '提交成功',
                    life: 3000,
                });
                setShowSubmissionDialog(false);
                loadLeaderboard();
            }
        } catch {
            toast.current?.show({
                severity: 'error',
                summary: '提交失败',
                detail: '请检查表单或稍后重试',
            });
        }
    };

    const genderOptions = [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-surface-50 to-primary-900 dark:from-surface-900 dark:to-surface-800 text-gray-900 dark:text-gray-100 p-6 md:p-12">
            <Toast ref={toast} />

            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                {/* 顶部标题 */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold flex justify-center items-center gap-3">
                        <Trophy className="text-primary-500 w-10 h-10" />
                        引体向上挑战排行榜
                    </h1>
                    <p className="text-gray-500 mt-2">展现力量与毅力的舞台！</p>
                </div>

                {/* 按钮 */}
                <div className="flex justify-center flex-wrap gap-4 mt-4">
                    <Button
                        label="提交我的记录"
                        icon="pi pi-upload"
                        className="p-button-success"
                        onClick={() => setShowSubmissionDialog(true)}
                    />
                    <Button
                        label="刷新排行榜"
                        icon="pi pi-refresh"
                        className="p-button-primary"
                        onClick={loadLeaderboard}
                    />
                </div>

                {/* 信息卡片区：PC 双列 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* 活动介绍 */}
                    <Card className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <Info className="w-6 h-6 text-primary-500" />
                            <h2 className="text-xl font-semibold">活动介绍</h2>
                        </div>
                        <p>
                            欢迎参加引体向上挑战赛！无论男女，记录你能完成的最大负重引体向上重量。
                            向极限发起挑战，赢取属于你的荣耀！
                        </p>
                    </Card>

                    {/* 评判标准 */}
                    <Card className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <Scale className="w-6 h-6 text-primary-500" />
                            <h2 className="text-xl font-semibold">评判标准</h2>
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>标准引体向上动作：下巴需高于杠面。</li>
                            <li>负重需清晰展示。</li>
                            <li>视频需完整录制，无剪辑。</li>
                        </ul>
                    </Card>

                    {/* 奖品设置 */}
                    <Card className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <Gift className="w-6 h-6 text-primary-500" />
                            <h2 className="text-xl font-semibold">奖品设置</h2>
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>冠军：定制奖杯 + 训练礼包</li>
                            <li>亚军：高端运动护腕</li>
                            <li>季军：能量营养补剂</li>
                        </ul>
                    </Card>

                    {/* 注意事项 */}
                    <Card className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <Info className="w-6 h-6 text-primary-500" />
                            <h2 className="text-xl font-semibold">注意事项</h2>
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>每人仅可提交一次有效记录。</li>
                            <li>提交内容须真实有效。</li>
                            <li>如有争议，主办方拥有最终解释权。</li>
                        </ul>
                    </Card>
                </div>

                {/* 排行榜区域 */}
                <div className="mt-10">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                        <Trophy className="w-7 h-7 text-primary-500" />
                        排行榜
                    </h2>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} height="6rem" borderRadius="12px" />
                            ))}
                        </div>
                    ) : (
                        <Card className="p-4 overflow-x-auto">
                            <DataTable
                                value={records}
                                stripedRows
                                responsiveLayout="scroll"
                                className="min-w-full"
                            >
                                <Column field="rank" header="排名" body={rankBodyTemplate} />
                                <Column field="name" header="挑战者" />
                                <Column field="gender" header="性别" body={genderTemplate} />
                                <Column field="weight_kg" header="负重(kg)" />
                                <Column field="video_url" header="视频" body={videoTemplate} />
                                <Column field="notes" header="备注" />
                            </DataTable>
                        </Card>
                    )}
                </div>
            </div>

            {/* 提交记录弹窗 */}
            <Dialog
                header="提交我的记录"
                visible={showSubmissionDialog}
                onHide={() => setShowSubmissionDialog(false)}
                style={{ width: '90vw', maxWidth: '480px' }}
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
                    <InputText
                        placeholder="昵称"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    <Dropdown
                        options={genderOptions}
                        placeholder="性别"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.value })}
                    />
                    <InputNumber
                        placeholder="负重重量(kg)"
                        value={formData.weight_kg}
                        onValueChange={(e) =>
                            setFormData({ ...formData, weight_kg: e.value || 0 })
                        }
                    />
                    <InputText
                        placeholder="视频链接"
                        value={formData.video_url}
                        onChange={(e) =>
                            setFormData({ ...formData, video_url: e.target.value })
                        }
                    />
                    <InputTextarea
                        placeholder="备注（可选）"
                        value={formData.notes}
                        onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                        }
                        rows={3}
                    />

                    <div className="flex justify-end gap-3 mt-4">
                        <Button
                            type="button"
                            label="取消"
                            severity="secondary"
                            outlined
                            onClick={() => setShowSubmissionDialog(false)}
                        />
                        <Button type="submit" label="提交" icon="pi pi-check" />
                    </div>
                </form>
            </Dialog>
        </div>
    );
}
