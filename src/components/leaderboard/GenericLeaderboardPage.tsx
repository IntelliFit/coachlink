import React, { useEffect, useState } from 'react';
import { AuthService } from '../services/authService';
import leaderboardService, { LeaderboardRecord } from '../services/leaderboardService';

// 通用排行榜记录接口（使用leaderboardService中的类型）
export interface GenericLeaderboardRecord {
  rank: number;
  id: string;
  name: string;
  nickname: string;
  gender?: string;
  weight_kg: number;
  reps: number;
  video_url: string | null;
  created_at: string;
  submitted_at: string;
  notes?: string;
  submission_status: 'pending' | 'approved' | 'rejected';
  leaderboard_type: 'pullup' | 'bench_press' | 'squat' | 'deadlift';
}

// 排行榜配置接口
export interface LeaderboardConfig {
  id: string;
  title: string;
  description: string;
  unit: string; // 重量单位，如 "kg"
  activityInfo: {
    startDate: string;
    endDate: string;
    organizer: string;
    participantCount?: number;
  };
  rules: {
    title: string;
    items: string[];
  }[];
  prizes?: {
    fixed: string[];
    lottery?: string[];
  };
  referenceVideos?: {
    title: string;
    url: string;
    description: string;
  }[];
}

// 组件Props接口
interface GenericLeaderboardPageProps {
  config: LeaderboardConfig;
  onNavigate: (view: string) => void;
  authService: AuthService;
}

const GenericLeaderboardPage: React.FC<GenericLeaderboardPageProps> = ({
  config,
  onNavigate,
  authService
}) => {
  // 状态管理
  const [records, setRecords] = useState<GenericLeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserSubmission, setShowUserSubmission] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);

  // 用户提交表单状态
  const [userSubmission, setUserSubmission] = useState({
    nickname: '',
    gender: '' as 'male' | 'female' | '',
    weight: '',
    reps: '',
    videoUrl: '',
    notes: ''
  });

  // 获取排行榜数据
  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 使用新的通用leaderboardService
      const leaderboardType = config.id as 'pullup' | 'bench_press' | 'squat' | 'deadlift';
      const data = await leaderboardService.getLeaderboard(leaderboardType);
      
      setRecords(data || []);
    } catch (err: any) {
      console.error('获取排行榜数据失败:', err);
      setError('获取排行榜数据失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 用户提交记录
  const handleUserSubmission = async () => {
    setSubmissionLoading(true);
    try {
      const authState = authService.getAuthState();
      
      if (!authState.isAuthenticated || !authState.user) {
        alert('请先登录后再提交记录。');
        onNavigate('login');
        setShowUserSubmission(false);
        return;
      }

      const weightValue = parseFloat(userSubmission.weight);
      const repsValue = parseInt(userSubmission.reps);

      if (isNaN(weightValue) || weightValue <= 0) {
        alert('请输入有效的重量数值');
        return;
      }

      if (isNaN(repsValue) || repsValue <= 0) {
        alert('请输入有效的次数');
        return;
      }

      if (!userSubmission.nickname.trim()) {
        alert('请输入昵称');
        return;
      }

      if (!userSubmission.videoUrl.trim()) {
        alert('请输入视频链接');
        return;
      }

      // 使用新的leaderboardService提交记录
      const leaderboardType = config.id as 'pullup' | 'bench_press' | 'squat' | 'deadlift';
      const data = await leaderboardService.submitRecord({
        nickname: userSubmission.nickname,
        weight_kg: weightValue,
        reps: repsValue,
        video_url: userSubmission.videoUrl,
        leaderboard_type: leaderboardType
      });

      alert('提交成功！您的记录已进入审核队列，审核通过后将显示在排行榜中。');
      
      // 重置表单
      setUserSubmission({
        nickname: '',
        gender: '',
        weight: '',
        reps: '',
        videoUrl: '',
        notes: ''
      });
      
      setShowUserSubmission(false);
      
    } catch (error: any) {
      console.error('提交失败:', error);
      alert(`提交失败: ${error.message}`);
    } finally {
      setSubmissionLoading(false);
    }
  };

  // 获取排名徽章样式
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          🥇 第1名
        </span>
      );
    } else if (rank === 2) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          🥈 第2名
        </span>
      );
    } else if (rank === 3) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
          🥉 第3名
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          第{rank}名
        </span>
      );
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [config.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{config.title}</h1>
              <p className="mt-2 text-sm text-gray-600">{config.description}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowUserSubmission(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                提交我的记录
              </button>
              <button
                onClick={() => onNavigate('user-submissions')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                我的提交
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 活动信息卡片 */}
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">活动信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">活动时间</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {config.activityInfo.startDate} - {config.activityInfo.endDate}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">参与人数</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {config.activityInfo.participantCount || records.length} 人
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">发起人</dt>
                <dd className="mt-1 text-sm text-gray-900">{config.activityInfo.organizer}</dd>
              </div>
            </div>
          </div>
        </div>

        {/* 活动规则 */}
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">活动介绍与评判标准</h3>
            <div className="space-y-4">
              {config.rules.map((ruleSection, index) => (
                <div key={index}>
                  <h4 className="font-medium text-gray-900 mb-2">{ruleSection.title}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    {ruleSection.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 排行榜 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">实时排行榜</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              当前共有 {records.length} 位挑战者
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">加载中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="mt-2 text-blue-600 hover:text-blue-500"
              >
                重试
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">暂无排行榜数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      排名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      挑战者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      性别
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      负重重量
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      训练视频
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankBadge(record.rank)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.nickname || record.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.gender ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.gender === 'male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {record.gender === 'male' ? '男' : '女'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.weight_kg} {config.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.reps} 次
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.video_url ? (
                          <a
                            href={record.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-500"
                          >
                            查看视频
                          </a>
                        ) : (
                          <span className="text-gray-400">无视频</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 用户提交模态框 */}
      {showUserSubmission && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-2 sm:p-4">
          <div className="relative top-8 sm:top-20 mx-auto p-4 sm:p-5 border w-full max-w-sm sm:max-w-md shadow-lg rounded-lg sm:rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">提交我的{config.title}记录</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">昵称</label>
                  <input
                    type="text"
                    value={userSubmission.nickname}
                    onChange={(e) => setUserSubmission({...userSubmission, nickname: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="请输入您的昵称"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">性别</label>
                  <select
                    value={userSubmission.gender}
                    onChange={(e) => setUserSubmission({...userSubmission, gender: e.target.value as 'male' | 'female'})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">请选择性别</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">负重重量 ({config.unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={userSubmission.weight}
                    onChange={(e) => setUserSubmission({...userSubmission, weight: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="请输入负重重量"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">次数</label>
                  <input
                    type="number"
                    min="1"
                    value={userSubmission.reps}
                    onChange={(e) => setUserSubmission({...userSubmission, reps: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="请输入完成次数"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">视频链接（可选）</label>
                  <input
                    type="url"
                    value={userSubmission.videoUrl}
                    onChange={(e) => setUserSubmission({...userSubmission, videoUrl: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="请输入视频链接"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">备注（可选）</label>
                  <textarea
                    value={userSubmission.notes}
                    onChange={(e) => setUserSubmission({...userSubmission, notes: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="请输入备注信息"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowUserSubmission(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleUserSubmission}
                  disabled={submissionLoading || !userSubmission.nickname || !userSubmission.gender || !userSubmission.weight || !userSubmission.reps}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submissionLoading ? '提交中...' : '提交记录'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenericLeaderboardPage;