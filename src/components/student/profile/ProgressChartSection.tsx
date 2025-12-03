import React, { useState } from 'react';
import { LineChart } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ProfileData } from './types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProgressChartSectionProps {
    data: ProfileData;
}

export const ProgressChartSection: React.FC<ProgressChartSectionProps> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<'weight' | 'bench' | 'squat' | 'deadlift'>('weight');
    const { progressData } = data;

    if (!progressData || progressData.dates.length === 0) {
        return null;
    }

    const getChartData = () => {
        let label = '';
        let datasetData: number[] = [];
        let color = '';
        let bgColor = '';

        switch (activeTab) {
            case 'weight':
                label = '体重 (kg)';
                datasetData = progressData.weight;
                color = 'rgb(99, 102, 241)'; // Indigo-500
                bgColor = 'rgba(99, 102, 241, 0.1)';
                break;
            case 'bench':
                label = '卧推 (kg)';
                datasetData = progressData.benchPress;
                color = 'rgb(236, 72, 153)'; // Pink-500
                bgColor = 'rgba(236, 72, 153, 0.1)';
                break;
            case 'squat':
                label = '深蹲 (kg)';
                datasetData = progressData.squat;
                color = 'rgb(168, 85, 247)'; // Purple-500
                bgColor = 'rgba(168, 85, 247, 0.1)';
                break;
            case 'deadlift':
                label = '硬拉 (kg)';
                datasetData = progressData.deadlift;
                color = 'rgb(234, 179, 8)'; // Yellow-500
                bgColor = 'rgba(234, 179, 8, 0.1)';
                break;
        }

        return {
            labels: progressData.dates,
            datasets: [
                {
                    label,
                    data: datasetData,
                    borderColor: color,
                    backgroundColor: bgColor,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
            ],
        };
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
            },
            x: {
                grid: {
                    display: false,
                },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                    ? 'bg-primary-50 text-primary'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                    <LineChart className="text-primary" size={20} />
                    进步趋势
                </h2>
                <div className="flex gap-1 bg-surface-50 p-1 rounded-lg">
                    <TabButton id="weight" label="体重" />
                    <TabButton id="bench" label="卧推" />
                    <TabButton id="squat" label="深蹲" />
                    <TabButton id="deadlift" label="硬拉" />
                </div>
            </div>

            <div className="h-[300px] w-full">
                <Line data={getChartData()} options={options} />
            </div>
        </div>
    );
};
