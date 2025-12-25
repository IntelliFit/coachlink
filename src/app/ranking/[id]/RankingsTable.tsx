'use client';

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Video, User } from 'lucide-react';
import { LeaderboardFormInput } from '@/types/leaderboard';
import { LeaderboardEntryWithProfile } from '@/app/api/ranking/list-entries/entity';

interface RankingsTableProps {
    entries: LeaderboardEntryWithProfile[];
    formSchema: LeaderboardFormInput[];
}

const RankingsTable = ({ entries, formSchema }: RankingsTableProps) => {
    // 1. 排名模板
    const rankBodyTemplate = (rowData: LeaderboardEntryWithProfile, { rowIndex }: any) => {
        const rank = rowIndex + 1;
        const getRankClass = () => {
            if (rank === 1) return 'text-yellow-500 bg-yellow-50';
            if (rank === 2) return 'text-slate-400 bg-slate-50';
            if (rank === 3) return 'text-orange-400 bg-orange-50';
            return 'text-gray-500';
        };

        return (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${getRankClass()}`}>
                {rank}
            </div>
        );
    };

    // 2. 挑战者信息模板 (从 extra_data 读取)
    const challengerTemplate = (rowData: LeaderboardEntryWithProfile) => {
        return (
            <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                    {rowData.userProfile?.name || (rowData.extra_data as any)?.douyin_nickname || '匿名挑战者'}
                </span>
            </div>
        );
    };

    // 3. 动态列：根据 formSchema 生成
    // 注意：这里的 field 逻辑需要根据 rowData.form_data (数组) 进行解析
    const dynamicColumns = formSchema.map((field, index) => {
        return (
            <Column
                key={field.name + index}
                header={field.name}
                body={(rowData: LeaderboardEntryWithProfile) => {
                    const targetField = (rowData.form_data as unknown as LeaderboardFormInput[])?.find(item => item.name === field.name);
                    const val = targetField?.userInput;

                    if (val === undefined || val === null || val === '') {
                        return <span className="text-gray-300">-</span>;
                    }

                    if (typeof val === 'string' && val.startsWith('https://')) {
                        return (
                            <a href={val} target="_blank" rel="noopener noreferrer" 
                               className="text-primary-500 hover:text-primary-700 flex items-center gap-1">
                                <Video className="w-4 h-4" /> 查看
                            </a>
                        );
                    }

                    return <span>{val}</span>;
                }}
                sortable={false} // 核心排序已由数据库字段 score 完成
            />
        );
    });

    // 4. 备注列模板
    const notesTemplate = (rowData: LeaderboardEntryWithProfile) => {
        return (
            <span className="text-sm text-gray-500 truncate max-w-[150px] inline-block">
                {rowData.note || '-'}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <i className="pi pi-chart-bar text-primary-500"></i>
                    实时排名
                </h2>
                <span className="text-sm text-gray-400">更新时间: {new Date().toLocaleDateString()}</span>
            </div>

            <DataTable
                value={entries}
                breakpoint="960px"
                stripedRows
                rows={20}
                className="p-datatable-sm"
                emptyMessage="暂无挑战数据，快来提交吧！"
            >
                <Column header="排名" body={rankBodyTemplate} style={{ width: '5rem' }} />
                <Column header="挑战者" body={challengerTemplate} />
                
                {/* 插入动态生成的业务列 */}
                {dynamicColumns}

                {/* score 是我们数据库中冗余的排序主指标，通常作为最核心的成绩显示 */}
                <Column 
                    header="最终成绩" 
                    field="score" 
                    body={(rowData) => <span className="font-bold text-primary-600 text-lg">{rowData.score}</span>} 
                />
                
                <Column header="备注" body={notesTemplate} />
            </DataTable>
        </div>
    );
};

export default RankingsTable;