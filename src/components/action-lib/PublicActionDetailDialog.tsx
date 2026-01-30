'use client';

import React, { useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';

function isVideoUrl(url: string) {
    const u = url.toLowerCase();
    return (
        u.endsWith('.mp4') ||
        u.endsWith('.webm') ||
        u.endsWith('.mov') ||
        u.endsWith('.m4v') ||
        u.includes('/videos/')
    );
}

export default function PublicActionDetailDialog(props: {
    visible: boolean;
    action: PublicActionItemDto | null;
    onHide: () => void;
}) {
    const { visible, action, onHide } = props;

    const typeMeta = useMemo(() => {
        const type = action?.type || 'STRENGTH';
        const map: Record<string, { label: string; className: string; icon: string }> = {
            STRENGTH: { label: '力量', className: 'bg-orange-50 text-orange-600', icon: 'pi pi-sliders-h' },
            DIET: { label: '饮食', className: 'bg-green-50 text-green-600', icon: 'pi pi-apple' },
            CARDIO: { label: '有氧', className: 'bg-blue-50 text-blue-600', icon: 'pi pi-bolt' },
            HABIT: { label: '习惯', className: 'bg-purple-50 text-purple-600', icon: 'pi pi-heart' },
        };
        return map[type] || map.STRENGTH;
    }, [action?.type]);

    const schema = (action?.item_schema || {}) as any;

    return (
        <Dialog
            header={action ? `动作详情：${action.name}` : '动作详情'}
            visible={visible}
            modal
            draggable={false}
            resizable={false}
            dismissableMask
            style={{ width: '720px', maxWidth: '95vw' }}
            onHide={onHide}
            className="p-fluid"
        >
            {!action ? (
                <div className="text-surface-600">暂无数据</div>
            ) : (
                <div className="flex flex-col gap-5">
                    {/* Summary */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${typeMeta.className}`}>
                                    <i className={`${typeMeta.icon} mr-1`} />
                                    {typeMeta.label}
                                </span>
                                <span className="text-xs text-surface-500">
                                    点赞 {action.like_count || 0}
                                </span>
                            </div>
                            <div className="mt-2 text-sm text-surface-700 whitespace-pre-wrap">
                                {action.detail || '暂无描述'}
                            </div>
                        </div>
                        <div className="text-right shrink-0 text-xs text-surface-500">
                            <div>贡献者：{action.contributor?.nickname || '用户'}</div>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">训练部位</div>
                        <div className="flex flex-wrap gap-2">
                            {(action.positions || []).length ? (
                                (action.positions || []).map((p, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                        {p}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-surface-500">暂无</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">动作属性</div>
                        <div className="flex flex-wrap gap-2">
                            {(action.attrs || []).length ? (
                                (action.attrs || []).map((a, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-surface-100 text-surface-700">
                                        {a}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-surface-500">暂无</span>
                            )}
                        </div>
                    </div>

                    {/* Type-specific details */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-4">
                        <div className="text-xs font-semibold text-surface-700 mb-2">详细配置</div>
                        {action.type === 'STRENGTH' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>智能重量计算：{action.enableAutoWeightCompute ? '开启' : '关闭'}</div>
                                <div>包含自重：{action.includesBodyWeight ? '是' : '否'}</div>
                            </div>
                        )}
                        {action.type === 'DIET' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>热量(kcal)：{schema.calories ?? '—'}</div>
                                <div>推荐时间：{action.suggested_time || '—'}</div>
                            </div>
                        )}
                        {action.type === 'CARDIO' && (
                            <div className="text-sm text-surface-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>距离(km)：{schema.distance ? (schema.distance / 1000).toFixed(2) : '—'}</div>
                                <div>时长(min)：{schema.duration ? Math.round(schema.duration / 60) : '—'}</div>
                                <div>配速：{schema.pace ?? '—'}</div>
                            </div>
                        )}
                        {action.type === 'HABIT' && (
                            <div className="text-sm text-surface-700">
                                目标：{schema.target_duration ?? '—'}
                            </div>
                        )}
                    </div>

                    {/* Video */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold text-surface-600">演示视频</div>
                        {!action.url ? (
                            <div className="text-sm text-surface-500">暂无</div>
                        ) : isVideoUrl(action.url) ? (
                            <video
                                controls
                                src={action.url}
                                className="w-full rounded-xl border border-surface-200 bg-black"
                            />
                        ) : (
                            <a
                                href={action.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary-600 underline"
                            >
                                打开演示链接
                            </a>
                        )}
                    </div>
                </div>
            )}
        </Dialog>
    );
}

