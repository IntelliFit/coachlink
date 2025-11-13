import React from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Video } from 'lucide-react';

interface RankingsTableProps {
    records: any[];
    loading: boolean;
}

const RankingsTable = ({ records, loading }: RankingsTableProps) => {
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
                className="text-primary-600 hover:text-primary-700 hover:underline transition-colors flex gap-1"
            >
                查看
                <Video />
            </a>
        ) : (
            '-'
        );

    return (
        <div className="mt-10">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                <i className="pi pi-trophy text-primary-500"></i>
                实时排行榜
            </h2>
            {loading ? (
                <div className="grid grid-cols-1 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} height="6rem" borderRadius="12px" />
                    ))}
                </div>
            ) : (
                <DataTable
                    value={records}
                    stripedRows
                    className="min-w-full text-sm sm:text-base"
                >
                    <Column field="rank" header="排名" body={rankBodyTemplate} />
                    <Column field="name" header="挑战者" />
                    <Column field="gender" header="性别" body={genderTemplate} />
                    <Column field="weight_kg" header="负重(kg)" />
                    <Column field="video_url" header="视频" body={videoTemplate} />
                    <Column field="notes" header="备注" />
                </DataTable>
            )}
        </div>
    );
};

export default RankingsTable;