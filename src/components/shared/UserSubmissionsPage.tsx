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
  AlertCircle,
  Calendar
} from 'lucide-react';

// 定义用户提交记录类型
interface UserSubmission {
  id: string;
  weight_kg: number;
  gender: string;
  video_url: string | null;
  douyin_nickname: string;
  notes: string | null;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface UserSubmissionsPageProps {
  onNavigate: (view: string) => void;
}

const UserSubmissionsPage: React.FC<UserSubmissionsPageProps> = ({ onNavigate }) => {
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const authService = AuthService.getInstance();
  const currentUser = authService.getAuthState().user;

  // 获取用户提交记录
  const fetchUserSubmissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 使用自定义认证系统获取当前用户ID
      const authState = authService.getAuthState();
      const userId = authState.user?.id;
      
      if (!userId) {
        setError('请先登录后再查看提交记录');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('get-user-submissions', {
        body: { user_id: userId }
      });
      
      if (error) throw error;
      
      // 映射后端字段到前端期望的字段名
      const mappedRecords = (data.records || []).map((record: any) => ({
        ...record,
        status: record.submission_status // 将 submission_status 映射为 status
      }));
      
      setSubmissions(mappedRecords);
    } catch (err: any) {
      console.error('获取提交记录失败:', err);
      setError('获取提交记录失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 格式化性别
  const formatGender = (gender: string): string => {
    return gender === 'male' ? '男' : '女';
  };

  // 格式化时间
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 获取状态显示
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5" />,
          text: '待审核',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      case 'approved':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          text: '已通过',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'rejected':
        return {
          icon: <XCircle className="w-5 h-5" />,
          text: '已拒绝',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          text: '未知状态',
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  useEffect(() => {
    fetchUserSubmissions();
  }, []);

  // 移除登录检查，支持匿名访问

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
                <h1 className="text-3xl font-bold text-gray-800">我的提交记录</h1>
                <p className="text-gray-600">查看您的引体记录提交历史</p>
              </div>
            </div>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
              总计: {submissions.length} 条记录
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
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchUserSubmissions}
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              重试
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
            <User className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-blue-800 mb-2">暂无提交记录</h3>
            <p className="text-blue-600 mb-4">您还没有提交过任何引体记录</p>
            <button
              onClick={() => onNavigate('leaderboard')}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              去提交记录
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {/* 底部提示 */}
      <div className="container mx-auto px-4 pb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div className="text-blue-800">
              <p className="font-medium mb-1">提交说明:</p>
              <ul className="text-sm space-y-1">
                <li>• 记录提交后需要管理员审核才能显示在排行榜上</li>
                <li>• 请确保视频清晰展示完整的引体向上动作</li>
                <li>• 如有疑问，请联系管理员</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSubmissionsPage;