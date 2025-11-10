import React from 'react';
import { 
  Shield, 
  Users, 
  BarChart3, 
  Settings, 
  Activity,
  FileText,
  Award,
  Database,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (view: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  // 模拟管理员统计数据
  const stats = {
    totalUsers: 1250,
    totalCoaches: 45,
    totalRecords: 890,
    pendingApplications: 12,
    activeSubscriptions: 567,
    todayActiveUsers: 89
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            className="text-blue-600 hover:text-blue-800"
            onClick={() => onNavigate('dashboard')}
          >
            ← 返回首页
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">管理员后台</h1>
            <p className="text-gray-600">系统管理和数据监控</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg">
          <Shield className="w-5 h-5" />
          <span className="font-medium">管理员模式</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">认证教练</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCoaches}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">训练记录</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">待审核申请</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingApplications}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">活跃订阅</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeSubscriptions}</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">今日活跃用户</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayActiveUsers}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 管理功能区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 用户管理 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">用户管理</h3>
              <p className="text-sm text-gray-600">管理用户账户和权限</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">用户列表</span>
                <span className="text-sm text-gray-500">查看所有用户</span>
              </div>
            </button>
            <button 
              onClick={() => onNavigate('coach_review')}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-700">教练申请审核</span>
                <span className="text-sm text-orange-600 font-medium">{stats.pendingApplications} 待处理</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">权限管理</span>
                <span className="text-sm text-gray-500">设置用户权限</span>
              </div>
            </button>
          </div>
        </div>

        {/* 内容管理 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">内容管理</h3>
              <p className="text-sm text-gray-600">管理平台内容和数据</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => onNavigate('pullup_leaderboard')}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-700">排行榜管理</span>
                <span className="text-sm text-blue-600">编辑记录</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">教练资料管理</span>
                <span className="text-sm text-gray-500">审核教练信息</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">系统公告</span>
                <span className="text-sm text-gray-500">发布公告</span>
              </div>
            </button>
          </div>
        </div>

        {/* 数据分析 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">数据分析</h3>
              <p className="text-sm text-gray-600">查看平台运营数据</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">用户增长分析</span>
                <span className="text-sm text-gray-500">查看趋势</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">收入统计</span>
                <span className="text-sm text-gray-500">订阅收入</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">活跃度报告</span>
                <span className="text-sm text-gray-500">用户行为</span>
              </div>
            </button>
          </div>
        </div>

        {/* 系统设置 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">系统设置</h3>
              <p className="text-sm text-gray-600">配置系统参数</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">系统配置</span>
                <span className="text-sm text-gray-500">基础设置</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">数据库管理</span>
                <span className="text-sm text-gray-500">数据维护</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">日志查看</span>
                <span className="text-sm text-gray-500">系统日志</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => onNavigate('pullup_leaderboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            管理排行榜
          </button>
          <button 
            onClick={() => onNavigate('coach_review')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            审核申请
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            查看数据
          </button>
          <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            系统设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 