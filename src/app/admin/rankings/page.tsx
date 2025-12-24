'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import CreateLeaderboardForm from './CreateLeaderboardForm';
import { LeaderboardTemplateRow } from '@/types';
import { rankingService } from '@/app/service/rankingService';

export default function AdminRankingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToastContext();
  
  const [rankings, setRankings] = useState<LeaderboardTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 检查用户权限
  if (status === 'loading') {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (!session?.user?.is_admin) {
    router.push('/');
    return null;
  }

  useEffect(() => {
    loadRankings();
  }, [refreshTrigger]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      
      const result = await rankingService.listLeaderboard();
      
      if (result) {
        setRankings(result.leaderboards || []);
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

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const result = await rankingService.deleteLeaderboard({ id: deleteId });
      
      if (result?.success) {
        showToast({ 
          severity: 'success', 
          summary: '成功', 
          detail: '排行榜删除成功' 
        });
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast({ 
          severity: 'error', 
          summary: '失败', 
          detail: '排行榜删除失败' 
        });
      }
    } catch (error) {
      console.error('删除排行榜失败:', error);
      showToast({ 
        severity: 'error', 
        summary: '失败', 
        detail: '排行榜删除失败' 
      });
    } finally {
      setDeleteId(null);
      setConfirmVisible(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setConfirmVisible(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '未设置';
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
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium 
        ${severity === 'success' ? 'bg-green-100 text-green-800' : 
          severity === 'danger' ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'}`}>
        {status}
      </span>
    );
  };

  if (loading && rankings.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900">排行榜管理</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, idx) => (
            <Card key={idx} className="border border-surface-200 shadow-none">
              <div className="flex flex-col gap-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="h-8 bg-gray-200 rounded mt-4"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          label="创建新排行榜" 
          icon="pi pi-plus" 
          onClick={() => setShowCreateDialog(true)}
        />
      </div>

      {rankings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rankings.map((ranking) => (
            <Card 
              key={ranking.id} 
              className="border border-surface-200 shadow-none flex flex-col h-full"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-surface-800">{ranking.title}</h3>
                  {statusTemplate(ranking)}
                </div>
                
                <p className="text-surface-600 text-sm mb-3 line-clamp-2">
                  {ranking.description || '暂无描述'}
                </p>
                
                <div className="text-xs text-surface-500 mb-3">
                  <div>排名字段: <span className="font-medium">{ranking.rank_by_field}</span></div>
                  <div>类型: <span className="font-medium">{ranking.type || '未设置'}</span></div>
                  <div>开始时间: <span className="font-medium">{formatDate(ranking.start_at)}</span></div>
                  <div>结束时间: <span className="font-medium">{formatDate(ranking.end_at)}</span></div>
                </div>
                
                {ranking.remarks && (
                  <div className="text-xs text-surface-500 mb-3">
                    备注: {ranking.remarks}
                  </div>
                )}
              </div>
              
              <div className="mt-auto pt-4 flex justify-end gap-2">
                <Button 
                  icon="pi pi-trash" 
                  size="small"
                  severity="danger"
                  text
                  onClick={() => confirmDelete(ranking.id)}
                  tooltip="删除"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">暂无排行榜数据</div>
          <Button 
            label="创建第一个排行榜" 
            icon="pi pi-plus" 
            onClick={() => setShowCreateDialog(true)}
          />
        </div>
      )}

      <Dialog 
        header="创建新排行榜" 
        visible={showCreateDialog} 
        onHide={() => setShowCreateDialog(false)}
        style={{ width: '800px', maxWidth: '95vw' }}
        breakpoints={{ '768px': '95vw' }}
      >
        <CreateLeaderboardForm onSuccess={handleCreateSuccess} />
      </Dialog>

      <ConfirmDialog
        visible={confirmVisible}
        onHide={() => {
          setConfirmVisible(false);
          setDeleteId(null);
        }}
        message="确定要删除这个排行榜吗？此操作不可撤销。"
        header="确认删除"
        icon="pi pi-exclamation-triangle"
        acceptLabel="是"
        rejectLabel="否"
        accept={handleDelete}
        reject={() => {
          setConfirmVisible(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}