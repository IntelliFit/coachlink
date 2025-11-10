import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Award,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface CoachApplication {
  id: string;
  user_id: string;
  name: string;
  title: string;
  bio: string;
  specialties: string[];
  years_experience: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  // 用户信息
  user_phone?: string;
  user_email?: string;
}

interface CoachApplicationReviewProps {
  onBack: () => void;
}

const CoachApplicationReview: React.FC<CoachApplicationReviewProps> = ({ onBack }) => {
  const [applications, setApplications] = useState<CoachApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<CoachApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // 当筛选状态改变时重新加载数据
  useEffect(() => {
    loadApplications();
  }, [filter]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-coach-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          adminId: '53677f66-45ca-4800-b45d-2d1d734e4163', // 管理员用户ID
          status: filter === 'all' ? undefined : filter
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setApplications(result.data || []);
      } else {
        console.error('获取教练申请失败:', result.message);
        setApplications([]);
      }
    } catch (error) {
      console.error('加载教练申请失败:', error);
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewApplication = async (applicationId: string, action: 'approve' | 'reject', feedback?: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-review-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          adminId: '53677f66-45ca-4800-b45d-2d1d734e4163', // 管理员用户ID
          coachId: applicationId,
          action: action,
          feedback: feedback
        })
      });

      const result = await response.json();

      if (result.success) {
        // 更新本地状态
        setApplications(prev => prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: action === 'approve' ? 'approved' : 'rejected' }
            : app
        ));
        
        setSelectedApplication(null);
        alert(`申请已${action === 'approve' ? '通过' : '拒绝'}`);
      } else {
        alert('操作失败，请重试');
      }
    } catch (error) {
      console.error('审核申请失败:', error);
      alert('操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { text: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { text: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { text: '已拒绝', color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}天前`;
    }
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  if (selectedApplication) {
    return (
      <div className="space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedApplication(null)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">审核教练申请</h1>
              <p className="text-gray-600">{selectedApplication.name}的申请</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {(() => {
              const badge = getStatusBadge(selectedApplication.status);
              const Icon = badge.icon;
              return (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
                  <Icon className="w-4 h-4 inline mr-1" />
                  {badge.text}
                </span>
              );
            })()}
          </div>
        </div>

        {/* 申请详情 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 基本信息 */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">姓名</label>
                    <p className="font-medium text-gray-900">{selectedApplication.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">职位</label>
                    <p className="font-medium text-gray-900">{selectedApplication.title}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">从业年限</label>
                    <p className="font-medium text-gray-900">{selectedApplication.years_experience}年</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">申请时间</label>
                    <p className="font-medium text-gray-900">{getRelativeTime(selectedApplication.created_at)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">专业领域</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedApplication.specialties.map((specialty, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">个人简介</h4>
                <p className="text-gray-700 leading-relaxed">{selectedApplication.bio}</p>
              </div>
            </div>

            {/* 联系信息 */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">联系信息</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">手机号</label>
                    <p className="font-medium text-gray-900">{selectedApplication.user_phone}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">邮箱</label>
                    <p className="font-medium text-gray-900">{selectedApplication.user_email}</p>
                  </div>
                </div>
              </div>

              {/* 审核操作 */}
              {selectedApplication.status === 'pending' && (
                <div className="border-t pt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">审核操作</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleReviewApplication(selectedApplication.id, 'approve')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <ThumbsUp className="w-5 h-5" />
                      <span>{isProcessing ? '处理中...' : '通过申请'}</span>
                    </button>
                    <button
                      onClick={() => handleReviewApplication(selectedApplication.id, 'reject')}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <ThumbsDown className="w-5 h-5" />
                      <span>{isProcessing ? '处理中...' : '拒绝申请'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">教练申请审核</h1>
            <p className="text-gray-600">管理和审核教练申请</p>
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">筛选状态：</span>
          <div className="flex space-x-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'pending', label: '待审核' },
              { key: 'approved', label: '已通过' },
              { key: 'rejected', label: '已拒绝' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 申请列表 */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">加载中...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无申请</h3>
            <p className="text-gray-600">当前没有需要审核的教练申请</p>
          </div>
        ) : (
          filteredApplications.map((application) => {
            const badge = getStatusBadge(application.status);
            const StatusIcon = badge.icon;
            
            return (
              <div key={application.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{application.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {badge.text}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{application.title}</p>
                      <p className="text-gray-700 text-sm line-clamp-2 mb-3">{application.bio}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Award className="w-4 h-4" />
                          <span>{application.years_experience}年经验</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{getRelativeTime(application.created_at)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{application.specialties.length}个专业领域</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedApplication(application)}
                      className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>查看详情</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CoachApplicationReview;