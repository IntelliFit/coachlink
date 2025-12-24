'use client';

import React, { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { CheckCircle, Star, Video, ChevronDown, ChevronUp } from 'lucide-react';

interface ExecutionDetailsProps {
    execution: any;
    collapsed?: boolean;
}

/**
 * ExecutionDetails 组件 - 学员执行情况展示
 * 
 * 用于在教练端计划编辑页面展示学员的训练执行反馈
 * 支持折叠/展开功能
 */
const ExecutionDetails: React.FC<ExecutionDetailsProps> = ({ 
    execution, 
    collapsed = true 
}) => {
    const [isCollapsed, setIsCollapsed] = useState(collapsed);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // 如果没有执行数据或没有动作执行记录，不渲染
    if (!execution || !execution.action_executions) return null;

    // 提取已完成的组
    const completedSets = execution.action_executions.flatMap((ae: any) =>
        (ae.sets || []).filter((s: any) => s.status === 'completed').map((s: any) => ({
            ...s,
            action_name: ae.action_name
        }))
    );

    // 如果没有已完成的组，不渲染
    if (completedSets.length === 0) return null;

    // 计算统计数据
    const totalSets = completedSets.length;
    const breakthroughSets = completedSets.filter((s: any) => s.is_breakthrough || s.is_pr).length;

    const headerTemplate = () => (
        <div 
            className="flex items-center justify-between cursor-pointer py-2 px-3"
            onClick={() => setIsCollapsed(!isCollapsed)}
        >
            <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">学员执行情况</span>
                <span className="text-sm text-surface-500">
                    ({totalSets} 组完成
                    {breakthroughSets > 0 && `, ${breakthroughSets} 组进步`})
                </span>
            </div>
            <Button
                icon={isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                text
                rounded
                size="small"
                className="text-surface-500"
            />
        </div>
    );

    return (
        <>
            <div className="mt-4 border-t border-surface-200 pt-4">
                <div 
                    className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 overflow-hidden"
                >
                    {headerTemplate()}
                    
                    {!isCollapsed && (
                        <div className="p-3 border-t border-green-100">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-600">
                                            <th className="px-3 py-2 text-left font-medium">动作</th>
                                            <th className="px-3 py-2 text-left font-medium">组数</th>
                                            <th className="px-3 py-2 text-left font-medium">重量</th>
                                            <th className="px-3 py-2 text-left font-medium">次数</th>
                                            <th className="px-3 py-2 text-left font-medium">RPE</th>
                                            <th className="px-3 py-2 text-left font-medium">备注</th>
                                            <th className="px-3 py-2 text-left font-medium">视频</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedSets.map((set: any, idx: number) => (
                                            <tr key={idx} className="border-t border-surface-100 hover:bg-surface-50">
                                                <td className="px-3 py-2 font-medium text-surface-900">
                                                    <div className="flex items-center gap-1">
                                                        {set.action_name}
                                                        {set.is_pr && (
                                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                        )}
                                                        {set.is_breakthrough && !set.is_pr && (
                                                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">进步</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">第 {set.set_number} 组</td>
                                                <td className="px-3 py-2">{set.actual_weight ? `${set.actual_weight}kg` : '-'}</td>
                                                <td className="px-3 py-2">{set.actual_reps ?? '-'}</td>
                                                <td className="px-3 py-2">
                                                    {set.rpe ? (
                                                        <span className={set.rpe >= 9 ? 'text-red-600 font-medium' : ''}>
                                                            {set.rpe}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-surface-600 max-w-[120px] truncate">
                                                    {set.notes || '-'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {set.has_video && set.video_url ? (
                                                        <button
                                                            onClick={() => {
                                                                setCurrentVideoUrl(set.video_url);
                                                                setVideoModalVisible(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                        >
                                                            <Video className="w-4 h-4" />
                                                            <span className="text-xs">查看</span>
                                                        </button>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 视频播放模态框 */}
            <Dialog
                visible={videoModalVisible}
                onHide={() => {
                    setVideoModalVisible(false);
                    setCurrentVideoUrl(null);
                }}
                header="查看训练视频"
                style={{ width: '90vw', maxWidth: '800px' }}
                modal
                dismissableMask
            >
                {currentVideoUrl && (
                    <div className="flex justify-center">
                        <video
                            src={currentVideoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] rounded-lg"
                            style={{ backgroundColor: '#000' }}
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                )}
            </Dialog>
        </>
    );
};

export default ExecutionDetails;
