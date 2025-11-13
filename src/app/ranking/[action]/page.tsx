'use client';

import React, { useState, useEffect } from 'react';
import {
    Trophy,
    Info,
    Scale,
    Gift,
    XCircle,
    Video,
    CheckCircle,
    AlertTriangle,
    Target,
    Star,
    Calendar,
    Users
} from 'lucide-react';
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
import { useParams } from 'next/navigation';

export default function PullupLeaderboardPage() {
    const params = useParams();
    

    const { data: session } = useSession();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
    const [formData, setFormData] = useState({
        name: session?.profile.nickname || '',
        gender: session?.profile.gender || '',
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
            if (res) setRecords(res.records || []);
        } catch {
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
                className={`font-bold text-lg ${rank === 1
                    ? 'text-yellow-400'
                    : rank === 2
                        ? 'text-gray-300'
                        : rank === 3
                            ? 'text-amber-500'
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
                className="text-primary-600 hover:text-primary-700 hover:underline transition-colors"
            >
                查看
            </a>
        ) : (
            '-'
        );

    const genderOptions = [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await rankingService.submitRecord('pullup', {});
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 p-4 sm:p-6 md:p-10">
            <Toast ref={toast} />

            <div className="max-w-6xl mx-auto flex flex-col gap-10">
                {/* 标题区域 */}
                <div
                    className="relative w-full max-w-6xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-r from-primary to-primary-900
                    text-surface shadow-2xl p-8 md:p-16 flex flex-col items-center text-center"
                >
                    {/* 主体内容 */}
                    <div className="relative z-10 flex flex-col items-center space-y-4">

                        <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-5xl mx-auto text-center md:text-left gap-6 md:gap-10">
                            {/* 左侧标题区 */}
                            <div className="flex flex-col items-center md:items-start space-y-2">
                                <h1 className="text-4xl md:text-6xl font-extrabold flex items-center gap-3 drop-shadow-sm">
                                    <Trophy className="w-12 h-12 md:w-16 md:h-16 text-yellow-300 drop-shadow" />
                                    负重引体之王
                                </h1>
                                <p className="text-base md:text-lg text-surface/90 tracking-wide">
                                    月度排行榜挑战赛
                                </p>
                            </div>

                            {/* 右侧操作按钮区 */}
                            <div className="flex flex-wrap justify-center md:justify-end gap-3 sm:gap-4">
                                <Button
                                    label="提交我的记录"
                                    icon="pi pi-upload"
                                    onClick={() => setShowSubmissionDialog(true)}
                                />
                                <Button
                                    label="刷新排行榜"
                                    icon="pi pi-refresh"
                                    onClick={loadLeaderboard}
                                />
                            </div>
                        </div>


                        {/* 信息子卡片区域 */}
                        <div
                            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 w-full max-w-4xl"
                        >
                            {[
                                { icon: <Calendar className="w-6 h-6" />, title: '活动时间', value: '永久有效' },
                                { icon: <Users className="w-6 h-6" />, title: '参与人数', value: `${records.length} 位挑战者` },
                                { icon: <Trophy className="w-6 h-6" />, title: '发起人', value: '刘三乐（17项吉尼斯纪录保持者）' },
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex flex-col items-center justify-center text-center rounded-2xl
                               bg-white/10 backdrop-blur-sm p-5 sm:p-6 shadow-lg
                               border border-white/20 hover:bg-white/15 transition-all"
                                >
                                    <div className="flex items-center justify-center mb-2 text-yellow-300">
                                        {item.icon}
                                    </div>
                                    <h3 className="font-semibold text-surface text-base sm:text-lg mb-1">
                                        {item.title}
                                    </h3>
                                    <p className="text-surface/90 text-sm sm:text-base">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 活动介绍 & 评判标准 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center mb-4">
                            <Star className="w-6 h-6 text-yellow-500 mr-2" />
                            <h2 className="text-xl font-bold">活动介绍</h2>
                        </div>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                            <p>🏆 <strong>负重引体之王</strong> 是由17项吉尼斯纪录保持者刘三乐发起的月度挑战赛，旨在推广负重引体向上运动。</p>
                            <p>📱 在抖音发布挑战视频，并带话题 <span className="text-primary-600 font-medium">#bannydeer旗舰店</span> 与 <span className="text-purple-600 font-medium">#刘三乐挑战</span></p>
                            <p>🎯 挑战者在视频评论区留言成绩，格式："成绩：XX公斤"</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center mb-4">
                            <Target className="w-6 h-6 text-red-500 mr-2" />
                            <h2 className="text-xl font-bold">评判标准</h2>
                        </div>
                        <ul className="space-y-3 text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 一镜到底，禁止剪辑。</li>
                            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 起始手臂完全伸直，下巴过杠。</li>
                            <li className="flex items-start"><XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" /> 禁止借力，如甩腿或蹬地。</li>
                            <li className="flex items-start"><AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" /> 负重60kg以上需附称重视频。</li>
                        </ul>
                    </div>
                </div>

                {/* 排行榜 */}
                <div className="mt-10">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                        <Trophy className="w-7 h-7 text-primary-500" />
                        实时排行榜
                    </h2>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} height="6rem" borderRadius="12px" />
                            ))}
                        </div>
                    ) : (
                        <Card className="p-4 overflow-x-auto rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <DataTable
                                value={records}
                                stripedRows
                                responsiveLayout="scroll"
                                className="min-w-full text-sm sm:text-base"
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

                {/* 活动说明 */}
                <div className="mt-8 bg-blue-50 rounded-2xl p-6">
                    <div className="flex items-center mb-4">
                        <Info className="w-6 h-6 text-blue-500 mr-3" />
                        <h3 className="text-xl font-semibold text-gray-800">特别说明</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                        <div>
                            <p><strong>女性参赛者：</strong>最终成绩可乘以1.5倍计算</p>
                            <p><strong>称重要求：</strong>负重60公斤及以上需要拍摄称重视频</p>
                        </div>
                        <div>
                            <p><strong>相关抖音号：</strong>@bannydeer官方旗舰店 @刘三乐 @枭马葛</p>
                            <p><strong>活动解释权：</strong>归主办方所有</p>
                        </div>
                    </div>
                </div>

                {/* 提交弹窗 */}
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
                                className="rounded-xl"
                                onClick={() => setShowSubmissionDialog(false)}
                            />
                            <Button
                                type="submit"
                                label="提交"
                                icon="pi pi-check"
                                className="!bg-primary-600 !border-primary-600 hover:!bg-primary-700 rounded-xl"
                            />
                        </div>
                    </form>
                </Dialog>
            </div>
        </div>
    );
}
