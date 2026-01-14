'use client';

import React, { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';
import { Dropdown } from 'primereact/dropdown';
import { Skeleton } from 'primereact/skeleton';
import { e1rmService } from '@/app/service/e1rmService';
import { TrendingUp } from 'lucide-react';

interface E1RMProgressChartProps {
    studentId: string;
    coachId?: string; // Optional: filter actions by coach
    height?: string;
}

interface ActionOption {
    label: string;
    value: string; // action_id
}

export const E1RMProgressChart: React.FC<E1RMProgressChartProps> = ({ 
    studentId, 
    coachId,
    height = '250px' 
}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [chartData, setChartData] = useState<any>({});
    const [chartOptions, setChartOptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingActions, setLoadingActions] = useState(true);
    
    const [availableActions, setAvailableActions] = useState<ActionOption[]>([]);
    const [selectedActionId, setSelectedActionId] = useState<string>('');
    const [selectedActionName, setSelectedActionName] = useState<string>('');

    // Fetch available actions on mount
    useEffect(() => {
        const fetchAvailableActions = async () => {
            setLoadingActions(true);
            try {
                const response = await fetch('/api/student/get-available-actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coachId, targetUserId: studentId })
                });
                const result = await response.json();
                
                if (result.success && result.data?.actions) {
                    const options = result.data.actions.map((a: { actionId: string; actionName: string }) => ({
                        label: a.actionName,
                        value: a.actionId
                    }));
                    setAvailableActions(options);
                    
                    // Auto-select first action if none selected
                    if (options.length > 0) {
                        setSelectedActionId(options[0].value);
                        setSelectedActionName(options[0].label);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch available actions:", error);
            } finally {
                setLoadingActions(false);
            }
        };

        fetchAvailableActions();
    }, [studentId, coachId]);

    // Fetch chart data when action changes
    useEffect(() => {
        if (!selectedActionId) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Use actionId for strict matching
                const data = await e1rmService.getHistory({
                    actionId: selectedActionId,
                    limit: 30,
                    targetUserId: studentId
                });

                if (data && data.history.length > 0) {
                    const labels = data.history.map(p => p.date);
                    const values = data.history.map(p => p.e1rm);

                    const documentStyle = getComputedStyle(document.documentElement);
                    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
                    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');
                    const primaryColor = documentStyle.getPropertyValue('--primary-color') || '#f97316';

                    const pointStyles = data.history.map((p: any) => p.isPR ? 'star' : 'circle');
                    const pointRadii = data.history.map((p: any) => p.isPR ? 8 : 4);
                    const pointColors = data.history.map((p: any) => p.isPR ? '#ef4444' : primaryColor); // Red for PRs

                    const newChartData = {
                        labels: labels,
                        datasets: [
                            {
                                type: 'line',
                                label: 'e1RM (kg)',
                                borderColor: primaryColor,
                                borderWidth: 2,
                                fill: true,
                                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                                tension: 0.4,
                                data: values,
                                pointStyle: pointStyles,
                                pointRadius: pointRadii,
                                pointHoverRadius: pointRadii.map(r => r + 2),
                                pointBackgroundColor: pointColors,
                                pointBorderColor: pointColors
                            }
                        ]
                    };

                    const options = {
                        maintainAspectRatio: false,
                        aspectRatio: 0.6,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    label: (context: any) => {
                                        return `e1RM: ${context.raw}kg`;
                                    },
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    afterLabel: (context: any) => {
                                        const point = data.history[context.dataIndex];
                                        if (point?.weight && point?.reps) {
                                            return `实际: ${point.weight}kg × ${point.reps}次`;
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: textColorSecondary,
                                    maxTicksLimit: 6
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                ticks: {
                                    color: textColorSecondary
                                },
                                grid: {
                                    color: surfaceBorder
                                }
                            }
                        }
                    };

                    setChartData(newChartData);
                    setChartOptions(options);
                } else {
                    setChartData({ labels: [], datasets: [] });
                }
            } catch (error) {
                console.error("Error loading chart:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [selectedActionId, studentId]);

    // Handle action change from dropdown
    const handleActionChange = (actionId: string) => {
        setSelectedActionId(actionId);
        const action = availableActions.find(a => a.value === actionId);
        setSelectedActionName(action?.label || '');
    };

    // No actions available - show empty state
    if (!loadingActions && availableActions.length === 0) {
        return (
            <div className="text-center py-8 text-surface-400">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无力量训练记录</p>
                <p className="text-xs mt-1">完成训练后将自动显示进步曲线</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                <h4 className="m-0 font-black text-sm sm:text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    力量进步曲线
                </h4>
                {loadingActions ? (
                    <Skeleton width="160px" height="32px" />
                ) : (
                    <Dropdown 
                        value={selectedActionId} 
                        options={availableActions} 
                        onChange={(e) => handleActionChange(e.value)} 
                        placeholder="选择动作"
                        className="p-inputtext-sm w-full sm:w-auto"
                        style={{ minWidth: '140px' }}
                    />
                )}
            </div>
            
            {loading ? (
                <Skeleton height={height} />
            ) : chartData.datasets && chartData.datasets.length > 0 && chartData.labels?.length > 0 ? (
                <Chart type="line" data={chartData} options={chartOptions} style={{ height }} />
            ) : (
                <div className="flex flex-col items-center justify-center text-surface-400 border rounded-xl bg-surface-50" style={{ height }}>
                    <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无 {selectedActionName} 数据</p>
                </div>
            )}
        </div>
    );
};
