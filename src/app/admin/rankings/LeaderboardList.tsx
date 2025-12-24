'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';

import { LeaderboardTemplateRow } from '@/types';

interface LeaderboardListProps {
  refreshTrigger: boolean;
  onEdit: (leaderboard: LeaderboardTemplateRow) => void;
  onDelete: (id: string) => void;
}

export default function LeaderboardList({ refreshTrigger, onEdit, onDelete }: LeaderboardListProps) {
  const { showToast } = useToastContext();
  const [rankings, setRankings] = useState<LeaderboardTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    loadRankings();
  }, [refreshTrigger]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      
      const reqData = {
        page: Math.floor(first / rows) + 1,
        limit: rows
      };
      
      const result = await rankingService.listLeaderboard(reqData);
      
      if (result) {
        setRankings(result.leaderboards || []);
        setTotalRecords(result.total || 0);
      } else {
        showToast({ 
          severity: 'error', 
          summary: '加载失败', 
          detail: '无法加载排行榜数据' 
        });
      }
    } catch (error) {
      console.error('加载排行榜失败:', error);
      showToast({ 
        severity: 'error', 
        summary: '加载失败', 
        detail: '无法加载排行榜数据' 
      });
    } finally {
      setLoading(false);
    }
  };

  const onPage = (event: any) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const statusTemplate = (rowData: LeaderboardTemplateRow) => {
    const now = new Date();
    const startAt = rowData.start_at ? new Date(rowData.start_at) : null;
    const endAt = rowData.end_at ? new Date(rowData.end_at) : null;
    
    let status = '未开始';
    let severity: 'success' | 'warning' | 'info' | 'danger' = 'info';
    
    if (startAt && now >= startAt) {
      if (endAt && now > endAt) {
        status = '已结束';
        severity = 'danger';
      } else {
        status = '进行中';
        severity = 'success';
      }
    }
    
    return <Tag value={status} severity={severity} />;
  };

  const actionTemplate = (rowData: LeaderboardTemplateRow) => {
    return (
      <div className="flex gap-2">
        <Button 
          icon="pi pi-pencil" 
          rounded 
          text
          severity="secondary"
          onClick={() => onEdit(rowData)}
          tooltip="编辑"
        />
        <Button 
          icon="pi pi-trash" 
          rounded 
          text
          severity="danger"
          onClick={() => onDelete(rowData.id)}
          tooltip="删除"
        />
      </div>
    );
  };

  if (loading && rankings.length === 0) {
    return (
      <Card className="border border-surface-200 shadow-none">
        <div className="p-4">
          <Skeleton width="100%" height="400px" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-surface-200 shadow-none">
      <DataTable 
        value={rankings} 
        paginator 
        rows={rows}
        totalRecords={totalRecords}
        first={first}
        onPage={onPage}
        loading={loading}
        stripedRows
        tableStyle={{ minWidth: '50rem' }}
      >
        <Column field="title" header="标题" />
        <Column field="description" header="描述" />
        <Column field="start_at" header="开始时间" body={(rowData) => formatDate(rowData.start_at)} />
        <Column field="end_at" header="结束时间" body={(rowData) => formatDate(rowData.end_at)} />
        <Column field="rank_by_field" header="排名字段" />
        <Column header="状态" body={statusTemplate} />
        <Column header="操作" body={actionTemplate} style={{ width: '120px' }} />
      </DataTable>
    </Card>
  );
}