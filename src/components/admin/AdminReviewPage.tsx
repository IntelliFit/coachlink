import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthService } from '../services/authService';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Weight, 
  Video, 
  MessageSquare,
  ArrowLeft,
  Eye
} from 'lucide-react';

// 定义待审核记录类型
interface PendingRecord {
  id: string;
  weight_kg: number;
  gender: string;
  video_url: string | null;
  douyin_nickname: string;
  notes: string | null;
  submitted_at: string;
  submitted_by: string;
  user_profiles: {
    full_name: string;
    phone: string;
  } | null;
}

interface AdminReviewPageProps {
  onNavigate: (view: string) => void;
}

const AdminReviewPage: React.FC<AdminReviewPageProps> = ({ onNavigate }) => {
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [currentRecord, setCurrentRecord] = useState<PendingRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const authService = AuthService.getInstance();
  const currentUser = authService.getAuthState().user;
  const isAdmin = currentUser?.is_admin === true;

  // 获取待审核记录
  const fetchPendingRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-pending-submissions', {
        body: {}
      });
      
      if (error) throw error;
      
      setPendingRecords(data.records || []);
    } catch (err: any) {
      console.error('获取待审核记录失败:', err);
      setError('获取待审核记录失败: ' + (err.message || '请稍后再试'));
    } finally {
      setLoading(false);
    }
  };

  // 审核记录
  const handleReview = async () => {
    if (!currentRecord) return;
    
    setReviewingId(currentRecord.id);

    try {
      console.log('Calling review function...');
      
      const { data, error } = await supabase.functions.invoke('review-pullup-submission', {
        body: {
          record_id: currentRecord.id,
          action: reviewAction,
          admin_feedback: adminFeedback || null
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      alert(`记录已${reviewAction === 'approve' ? '批准' : '拒绝'}！`);
      setShowReviewModal(false);
      setCurrentRecord(null);
      setAdminFeedback('');
      fetchPendingRecords(); // 重新加载数据
    } catch (error: any) {
      console.error('审核失败:', error);
      alert('审核失败: ' + (error.message || '未知错误'));
    } finally {
      setReviewingId(null);
    }
  };

  // 打开审核模态框
  const openReviewModal = (record: PendingRecord, action: 'approve' | 'reject') => {
    setCurrentRecord(record);
    setReviewAction(action);
    setShowReviewModal(true);
    setAdminFeedback('');
  };

  // 关闭审核模态框
  const closeReviewModal = () => {
    setShowReviewModal(false);
    setCurrentRecord(null);
    setAdminFeedback('');
  };

  // 格式化性别
  const formatGender = (gender: string): string => {
    return gender === 'male' ? '男' : '女';
  };

  // 格式化时间
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  useEffect(() => {
    if (!isAdmin) {
      setError('需要管理员权限才能访问此页面');
      return;
    }
    fetchPendingRecords();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">访问被拒绝</h2>
          <p className="text-gray-600 mb-4">您需要管理员权限才能访问此页面</p>
          <button
            onClick={() => onNavigate('leaderboard')}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            返回排行榜
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => onNavigate('leaderboard')}
                className="mr-4 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">记录审核</h1>
                <p className="text-gray-600">管理用户提交的引体记录</p>
              </div>
            </div>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
              待审核: {pendingRecords.length} 条
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        ) : pendingRecords.length === 0 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton width="200px" height="36px" />
              <Skeleton width="120px" height="36px" />
            </div>
            
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <Skeleton width="200px" height="150px" className="rounded-lg" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                      <Skeleton width="100px" height="24px" />
                      <Skeleton width="80px" height="20px" />
                    </div>
                    <Skeleton width="100%" height="20px" className="mb-2" />
                    <Skeleton width="80%" height="20px" className="mb-4" />
                    <div className="flex flex-wrap gap-2">
                      <Skeleton width="60px" height="28px" />
                      <Skeleton width="60px" height="28px" />
                      <Skeleton width="60px" height="28px" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton width="80px" height="36px" />
                    <Skeleton width="80px" height="36px" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchPendingRecords}
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              重试
            </button>
          </div>
        ) : pendingRecords.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-800 mb-2">暂无待审核记录</h3>
            <p className="text-green-600">所有提交的记录都已处理完毕</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {pendingRecords.map((record) => (
              <div key={record.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 基本信息 */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center mb-4">
                      <User className="w-5 h-5 text-gray-500 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-800">
                        {record.douyin_nickname}
                      </h3>
                      <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                        record.gender === 'male' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {formatGender(record.gender)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center">
                        <Weight className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-gray-700">
                          负重: <strong>{record.weight_kg} 公斤</strong>
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-gray-700">
                          提交时间: {formatDate(record.submitted_at)}
                        </span>
                      </div>
                    </div>

                    {record.user_profiles && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-600">
                          <strong>用户信息:</strong> {record.user_profiles.full_name} 
                          ({record.user_profiles.phone})
                        </p>
                      </div>
                    )}

                    {record.video_url && (
                      <div className="flex items-center mb-4">
                        <Video className="w-4 h-4 text-gray-500 mr-2" />
                        <a
                          href={record.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          查看视频
                        </a>
                      </div>
                    )}

                    {record.notes && (
                      <div className="flex items-start">
                        <MessageSquare className="w-4 h-4 text-gray-500 mr-2 mt-1" />
                        <div>
                          <p className="text-sm text-gray-600 font-medium mb-1">备注:</p>
                          <p className="text-gray-700">{record.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={() => openReviewModal(record, 'approve')}
                      disabled={reviewingId === record.id}
                      className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      批准
                    </button>
                    <button
                      onClick={() => openReviewModal(record, 'reject')}
                      disabled={reviewingId === record.id}
                      className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 审核模态框 */}
      {showReviewModal && currentRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {reviewAction === 'approve' ? '批准记录' : '拒绝记录'}
                </h2>
                <button
                  onClick={closeReviewModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  <strong>用户:</strong> {currentRecord.douyin_nickname}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>重量:</strong> {currentRecord.weight_kg} 公斤
                </p>
                <p className="text-gray-700">
                  <strong>性别:</strong> {formatGender(currentRecord.gender)}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  管理员反馈 (选填)
                </label>
                <textarea
                  value={adminFeedback}
                  onChange={(e) => setAdminFeedback(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={reviewAction === 'approve' ? '恭喜！记录已通过审核...' : '很抱歉，记录未通过审核，原因是...'}
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={closeReviewModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewingId === currentRecord.id}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                    reviewAction === 'approve'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {reviewingId === currentRecord.id ? '处理中...' : 
                   reviewAction === 'approve' ? '确认批准' : '确认拒绝'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewPage;