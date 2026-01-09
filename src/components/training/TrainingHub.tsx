import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import TrainingExecution from './TrainingExecution';
import TrainingProgressDashboard from './TrainingProgressDashboard';
import TrainingReminder from './TrainingReminder';
import TrainingPlanPreview from './TrainingPlanPreview';
import {
  Play,
  BarChart3,
  Bell,
  Calendar,
  Settings,
  Target,
  TrendingUp,
  Clock,
  Award,
  BookOpen,
  ArrowLeft
} from 'lucide-react';

interface TrainingHubProps {
  userId: string;
  trainingPlanId: string;
  coachId?: string;
  onBack?: () => void;
}

interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  duration_weeks: number;
  difficulty_level: string;
  ai_generated: boolean;
  coach_reviewed: boolean;
  created_at: string;
}

const TrainingHub: React.FC<TrainingHubProps> = ({
  userId,
  trainingPlanId,
  coachId,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'progress' | 'plan' | 'reminders'>('today');
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [planPreview, setPlanPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ todayCompleted: false, weekCompleted: 0, plannedPerWeek: 3, totalProgress: 0 });

  useEffect(() => {
    loadTrainingPlan();
    loadSummary();
  }, [trainingPlanId]);

  const loadTrainingPlan = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('id', trainingPlanId)
        .single();

      if (error) throw error;
      setTrainingPlan(data);

      // 加载详细天次，构建用于预览的结构化 weeks
      const { data: details, error: detailsError } = await supabase
        .from('training_plan_details')
        .select('*')
        .eq('training_plan_id', trainingPlanId)
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      if (detailsError) throw detailsError;

      const weeksMap: Record<number, { week: number; sessions: any[] }> = {};
      (details || []).forEach((row: any) => {
        if (!weeksMap[row.week_number]) {
          weeksMap[row.week_number] = { week: row.week_number, sessions: [] };
        }
        weeksMap[row.week_number].sessions.push({
          day: row.day_of_week,
          focus: row.session_focus,
          main: row.main_exercises || [],
          accessories: row.accessory_exercises || [],
          notes: row.notes || ''
        });
      });

      const weeks = Object.values(weeksMap).sort((a, b) => a.week - b.week);
      const frequencyPerWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w.sessions.length)) : 0;

      setPlanPreview({
        meta: {
          title: data.title,
          duration_weeks: data.duration_weeks || 6,
          frequency_per_week: frequencyPerWeek || 3,
          goal: data.difficulty_level,
          experience_level: data.difficulty_level,
          global_warmup: [],
          cooldown: [],
          safety_notes: []
        },
        weeks
      });
    } catch (error) {
      console.error('加载训练计划失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // 今日完成（本地兜底）
      const completionKey = `workout_completed_${trainingPlanId}_${today}`;
      const todayCompleted = typeof localStorage !== 'undefined' && localStorage.getItem(completionKey) === '1';

      // 计划频次/总天次：直接从 training_plan_details 统计，避免依赖前端状态
      const { data: details } = await supabase
        .from('training_plan_details')
        .select('week_number, day_of_week')
        .eq('training_plan_id', trainingPlanId);
      const totalDays = details?.length || 0;
      const weekToCount: Record<string, number> = {};
      (details || []).forEach((d: any) => {
        weekToCount[d.week_number] = (weekToCount[d.week_number] || 0) + 1;
      });
      const plannedPerWeek = Object.values(weekToCount).reduce((m, v) => Math.max(m, v), 0) || 3;

      // 本周完成：从 workout_logs 计数
      const now = new Date();
      const start = new Date(now);
      const day = now.getDay();
      const diffToMon = (day + 6) % 7; // 周一为起始
      start.setDate(now.getDate() - diffToMon);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const weekStart = start.toISOString().split('T')[0];
      const weekEnd = end.toISOString().split('T')[0];

      const { data: weekLogs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('training_plan_id', trainingPlanId)
        .gte('log_date', weekStart)
        .lt('log_date', weekEnd);

      const weekCompleted = weekLogs?.length || 0;

      // 总进度：已完成天次 / 计划总天次
      const { data: allLogs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('training_plan_id', trainingPlanId);

      const completedCount = allLogs?.length || 0;
      const totalProgress = totalDays > 0 ? Math.min(100, Math.round((completedCount / totalDays) * 100)) : 0;

      setSummary({ todayCompleted, weekCompleted, plannedPerWeek, totalProgress });
    } catch (e) {
      // 静默失败
    }
  };

  const tabs = [
    {
      id: 'today',
      name: '今日训练',
      icon: Play,
      description: '开始今天的训练'
    },
    {
      id: 'progress',
      name: '训练进度',
      icon: TrendingUp,
      description: '查看训练统计和进度'
    },
    {
      id: 'plan',
      name: '训练计划',
      icon: Calendar,
      description: '查看完整的训练安排'
    },
    {
      id: 'reminders',
      name: '训练提醒',
      icon: Bell,
      description: '设置训练提醒'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!trainingPlan) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">未找到训练计划</h3>
        <p className="text-gray-600">请先生成一个训练计划</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 训练计划头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center text-blue-100 hover:text-white transition-colors mr-4"
                >
                  <ArrowLeft className="w-5 h-5 mr-1" />
                  <span>返回</span>
                </button>
              )}
              <h1 className="text-2xl font-bold">{trainingPlan.title}</h1>
            </div>
            <p className="text-blue-100 mb-3">{trainingPlan.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{trainingPlan.duration_weeks}周</span>
              </div>
              <div className="flex items-center">
                <Target className="w-4 h-4 mr-1" />
                <span className="capitalize">{trainingPlan.difficulty_level}</span>
              </div>
              {trainingPlan.ai_generated && (
                <div className="bg-blue-500 px-2 py-1 rounded text-xs">
                  智能生成
                </div>
              )}
            </div>
          </div>
          <Award className="w-12 h-12 text-blue-200" />
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === 'today' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Play className="w-5 h-5 mr-2 text-green-600" />
                今日训练
              </h2>
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}
              </div>
            </div>
            <TrainingExecution
              trainingPlanId={trainingPlanId}
              userId={userId}
              onSessionComplete={() => {
                // 刷新统计数据
                console.log('训练完成，刷新统计...');
                loadSummary();
              }}
            />
          </div>
        )}

        {activeTab === 'progress' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                训练进度
              </h2>
            </div>
            <TrainingProgressDashboard
              userId={userId}
              trainingPlanId={trainingPlanId}
            />
          </div>
        )}

        {activeTab === 'plan' && trainingPlan && planPreview && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                训练计划详情
              </h2>
            </div>
            <TrainingPlanPreview
              plan={planPreview}
              showSaveButton={false}
              onStart={() => setActiveTab('today')}
            />
          </div>
        )}

        {activeTab === 'reminders' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Bell className="w-5 h-5 mr-2 text-orange-600" />
                训练提醒设置
              </h2>
            </div>
            <TrainingReminder
              userId={userId}
              trainingPlanId={trainingPlanId}
            />
          </div>
        )}
      </div>

      {/* 快速操作栏 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">今日训练</p>
              <p className="text-lg font-semibold text-gray-900">{summary.todayCompleted ? '已完成' : '待开始'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">本周完成</p>
              <p className="text-lg font-semibold text-gray-900">{summary.weekCompleted}/{summary.plannedPerWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">总进度</p>
              <p className="text-lg font-semibold text-gray-900">{summary.totalProgress}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingHub;