import React, { useState, useEffect } from 'react';
import supabase from '@/lib/supabaseClient';
import { generatePlanByCoachRules } from '../services/planEngine';

import { 
  Brain,
  CheckCircle,
  AlertCircle,
  Calendar,
  Play,
  Eye,
  Edit,
  Star,
  ArrowLeft,
  User,
  Dumbbell,
  Timer,
  Activity,
  Book,
  X
} from 'lucide-react';

interface Coach {
  id: string;
  name: string;
  title: string;
  rating: number;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_time: string;
  description: string;
  difficulty: string;
}

interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  duration_weeks: number;
  exercises_count: number;
  ai_generated: boolean;
  coach_reviewed: boolean;
  created_at: string;
  progress: number;
  exercises: Exercise[];
  weekly_schedule: string[];
  notes: string;
}

interface AITrainingPlanServiceProps {
  coach: Coach;
  onBack: () => void;
}

const AITrainingPlanService: React.FC<AITrainingPlanServiceProps> = ({
  coach,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'my_plans' | 'generate'>('my_plans');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // 新增：本页用于生成计划的简单表单状态，避免未定义错误
  const [formData, setFormData] = useState({
    goal: '',
    level: '',
    focus: '',
    duration: '6',
    frequency: '3',
    equipment: '',
    limitations: '',
    time_per_session: '60',
    specific_goals: ''
  });

  // 示例训练计划数据
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([
    {
      id: '1',
      title: '上肢力量提升计划',
      description: '专注于引体向上和臂屈伸的力量训练',
      difficulty_level: 'intermediate',
      duration_weeks: 8,
      exercises_count: 12,
      ai_generated: true,
      coach_reviewed: true,
      created_at: '2024-01-15T10:00:00Z',
      progress: 75,
      exercises: [
        {
          id: '1',
          name: '引体向上',
          sets: 4,
          reps: '8-12',
          rest_time: '90秒',
          description: '正手宽握，控制离心收缩',
          difficulty: 'intermediate'
        },
        {
          id: '2',
          name: '臂屈伸',
          sets: 3,
          reps: '10-15',
          rest_time: '60秒',
          description: '双杠或椅子支撑，全程控制',
          difficulty: 'intermediate'
        }
      ],
      weekly_schedule: ['周一', '周三', '周五'],
      notes: '注意动作标准，逐步增加难度'
    },
    {
      id: '2',
      title: '核心力量训练',
      description: '全面提升核心稳定性和力量',
      difficulty_level: 'beginner',
      duration_weeks: 6,
      exercises_count: 8,
      ai_generated: true,
      coach_reviewed: false,
      created_at: '2024-01-10T15:30:00Z',
      progress: 40,
      exercises: [
        {
          id: '3',
          name: '平板支撑',
          sets: 3,
          reps: '30-60秒',
          rest_time: '60秒',
          description: '保持身体一条直线，核心收紧',
          difficulty: 'beginner'
        }
      ],
      weekly_schedule: ['周二', '周四', '周六'],
      notes: '初学者从短时间开始，逐步增加'
    }
  ]);

  // 新架构状态
  const [currentStep, setCurrentStep] = useState<'domain' | 'assessment' | 'preview'>('domain');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [ruleEnginePlan, setRuleEnginePlan] = useState<any>(null);
  const [enhancedPlan, setEnhancedPlan] = useState<any>(null);
  const [useAIEnhancement, setUseAIEnhancement] = useState(true);
  const [aiEnhancements, setAiEnhancements] = useState<any>(null);

  const goals = [
    { id: 'strength', name: '力量增强', icon: '💪', description: '提升肌肉力量和爆发力' },
    { id: 'endurance', name: '耐力提升', icon: '🏃', description: '增强心肺功能和持久力' },
    { id: 'muscle', name: '肌肉增长', icon: '🦾', description: '增加肌肉体积和质量' },
    { id: 'fat_loss', name: '减脂塑形', icon: '🔥', description: '减少体脂率，塑造线条' },
    { id: 'flexibility', name: '柔韧性', icon: '🤸', description: '提高身体灵活性和活动度' },
    { id: 'general', name: '综合健身', icon: '⚡', description: '全面提升身体素质' }
  ];

  const levels = [
    { id: 'beginner', name: '初学者', description: '0-6个月经验，基础动作学习' },
    { id: 'intermediate', name: '中级', description: '6个月-2年经验，技巧提升' },
    { id: 'advanced', name: '高级', description: '2年以上经验，高强度训练' }
  ];

  const focusAreas = [
    { id: 'upper', name: '上肢', icon: '💪', description: '胸、背、肩、臂部训练' },
    { id: 'lower', name: '下肢', icon: '🦵', description: '腿部、臀部力量训练' },
    { id: 'core', name: '核心', icon: '🫀', description: '腹部、腰部稳定性训练' },
    { id: 'full_body', name: '全身', icon: '🧍', description: '全身协调性训练' },
    { id: 'cardio', name: '有氧', icon: '❤️', description: '心肺功能提升训练' }
  ];

  const equipmentOptions = [
    { id: 'none', name: '无器械', description: '仅使用体重训练' },
    { id: 'basic', name: '基础器械', description: '哑铃、杠铃、单杠' },
    { id: 'gym', name: '健身房', description: '完整健身房设备' },
    { id: 'home', name: '家庭器械', description: '弹力带、瑜伽垫等' }
  ];

  // 旧的本地模板生成器已移除，统一由规则引擎替代。

  const handleGenerate = async () => {
    // 简单验证
    if (!formData.goal || !formData.level || !formData.focus) {
      setMessage({ type: 'error', text: '请填写完整的训练需求信息' });
      return;
    }

    setIsGenerating(true);
    setMessage({ type: 'info', text: 'AI正在为您生成个性化训练计划...' });

    try {
      const userId = localStorage.getItem('current_user_id') || '';
      const preferences = {
        goal: formData.goal,
        level: formData.level,
        focus: formData.focus,
        duration: parseInt(formData.duration),
        frequency: parseInt(formData.frequency),
        equipment: formData.equipment,
        time_per_session: parseInt(formData.time_per_session),
        injuries: formData.limitations || '',
        specific_goals: formData.specific_goals || ''
      };

      // 优先调用 Edge Function（失败则兜底到规则引擎）
      let data: any | null = null;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-plan`;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId, preferences })
        });
        data = await resp.json();
      } catch (_) {
        const result = await supabase.functions.invoke('generate-ai-plan', {
          body: { userId, preferences }
        });
        data = result.data;
      }

      if (!data?.success) {
        throw new Error(data?.message || '生成失败');
      }
      // 合并新计划（优先展示落库计划；AI结构化结果可后续使用）
      const created = data.data;
      const newPlan: TrainingPlan = {
        id: created.id,
        title: created.title,
        description: created.description,
        difficulty_level: created.difficulty_level,
        duration_weeks: created.duration_weeks,
        exercises_count: (created.exercises || []).length,
        ai_generated: true,
        coach_reviewed: false,
        created_at: created.created_at,
        progress: 0,
        exercises: [],
        weekly_schedule: [],
        notes: ''
      };
      setTrainingPlans(prev => [newPlan, ...prev]);
      setMessage({ type: 'success', text: 'AI训练计划生成成功！' });
      setActiveTab('my_plans');
    } catch (e:any) {
      console.error(e);
      // 本地规则引擎兜底（确保不空白）
      try {
        const enginePlan = await generatePlanByCoachRules({
          userId: localStorage.getItem('current_user_id') || '',
          coachId: coach.id,
          goal: formData.goal as any,
          level: formData.level as any,
          focus: formData.focus as any,
          duration_weeks: parseInt(formData.duration),
          frequency_per_week: parseInt(formData.frequency),
          time_per_session: parseInt(formData.time_per_session),
          domain: 'weighted_pullup',
          assessment_data: {},
          weekly_frequency: parseInt(formData.frequency),
          session_duration: parseInt(formData.time_per_session),
          available_days: [],
          equipment: [],
          intensity_preference: 'balanced',
          rest_policy: 'medium',
          injuries: formData.limitations,
          specific_goal: formData.specific_goals
        } as any);

        const newPlan = {
          id: Date.now().toString(),
          title: enginePlan.meta.title,
          description: `${enginePlan.meta.duration_weeks}周 / 每周${enginePlan.meta.frequency_per_week}次`,
          difficulty_level: formData.level,
          duration_weeks: enginePlan.meta.duration_weeks,
          exercises_count: enginePlan.weeks.reduce((acc: number, w: any)=> acc + w.sessions.reduce((a: number,s: any)=> a + s.main.length + s.accessories.length,0), 0),
          ai_generated: true,
          coach_reviewed: false,
          created_at: new Date().toISOString(),
          progress: 0,
          exercises: [],
          weekly_schedule: [],
          notes: ''
        } as TrainingPlan;
        setTrainingPlans(prev => [newPlan, ...prev]);
        setMessage({ type: 'success', text: '已使用本地规则引擎生成训练计划。' });
        setActiveTab('my_plans');
      } catch (err) {
        console.error('本地规则引擎生成失败:', err);
        setMessage({ type: 'error', text: '生成失败，请稍后重试。' });
      }
    } finally {
      setIsGenerating(false);
      setFormData({
        goal: '',
        level: '',
        focus: '',
        duration: '6',
        frequency: '3',
        equipment: '',
        limitations: '',
        time_per_session: '60',
        specific_goals: ''
      });
    }
  };

  const getDifficultyBadge = (level: string) => {
    const badges = {
      beginner: { text: '初学者', color: 'bg-green-100 text-green-800' },
      intermediate: { text: '中级', color: 'bg-blue-100 text-blue-800' },
      advanced: { text: '高级', color: 'bg-purple-100 text-purple-800' }
    };
    return badges[level as keyof typeof badges] || badges.beginner;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return '今天';
    } else if (diffInDays === 1) {
      return '昨天';
    } else {
      return `${diffInDays}天前`;
    }
  };

  const renderPlanDetail = (plan: TrainingPlan) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{plan.title}</h2>
          <button
            onClick={() => setSelectedPlan(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{plan.duration_weeks}</div>
              <div className="text-sm text-gray-600">周期（周）</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{plan.exercises_count}</div>
              <div className="text-sm text-gray-600">练习数量</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{plan.progress}%</div>
              <div className="text-sm text-gray-600">完成进度</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">训练安排</h3>
          <div className="flex flex-wrap gap-2">
            {plan.weekly_schedule.map((day, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">训练动作</h3>
          <div className="space-y-4">
            {plan.exercises.map((exercise) => (
              <div key={exercise.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{exercise.name}</h4>
                  <span className={`px-2 py-1 rounded text-xs ${getDifficultyBadge(exercise.difficulty).color}`}>
                    {getDifficultyBadge(exercise.difficulty).text}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-2">
                  <div>
                    <span className="font-medium">组数：</span>{exercise.sets}
                  </div>
                  <div>
                    <span className="font-medium">次数：</span>{exercise.reps}
                  </div>
                  <div>
                    <span className="font-medium">休息：</span>{exercise.rest_time}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{exercise.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">训练说明</h3>
          <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{plan.notes}</p>
        </div>

        <div className="flex space-x-4">
          <button className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            开始训练
          </button>
          <button className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">
            编辑计划
          </button>
        </div>
      </div>
    );
  };

  if (selectedPlan) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            {renderPlanDetail(selectedPlan)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">AI训练计划生成</h1>
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回</span>
            </button>
          </div>

          {/* 教练信息 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{coach.name}</h2>
                <p className="text-gray-600">{coach.title}</p>
                <div className="flex items-center space-x-1 mt-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600">{coach.rating}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' :
              message.type === 'error' ? 'bg-red-50 text-red-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              <div className="flex items-center space-x-2">
                {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {message.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {message.type === 'info' && <Brain className="w-5 h-5" />}
                <span>{message.text}</span>
              </div>
            </div>
          )}

          {/* 标签页 */}
          <div className="flex space-x-1 mb-8">
            <button
              onClick={() => setActiveTab('my_plans')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'my_plans'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              我的训练计划
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              生成新计划
            </button>
          </div>

          {activeTab === 'my_plans' && (
            <div className="space-y-6">
              {trainingPlans.length === 0 ? (
                <div className="text-center py-12">
                  <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">还没有训练计划</h3>
                  <p className="text-gray-600 mb-4">点击"生成新计划"开始创建您的个性化训练计划</p>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    生成新计划
                  </button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {trainingPlans.map((plan) => (
                    <div key={plan.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.title}</h3>
                          <p className="text-gray-600 mb-3">{plan.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{plan.duration_weeks}周</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Dumbbell className="w-4 h-4" />
                              <span>{plan.exercises_count}个动作</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Timer className="w-4 h-4" />
                              <span>{getRelativeTime(plan.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded text-xs ${getDifficultyBadge(plan.difficulty_level).color}`}>
                            {getDifficultyBadge(plan.difficulty_level).text}
                          </span>
                          {plan.coach_reviewed && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              已审核
                            </span>
                          )}
                          {plan.ai_generated && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                              AI生成
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">进度</span>
                          <span className="text-sm font-medium text-gray-900">{plan.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${plan.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => setSelectedPlan(plan)}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4" />
                          <span>查看详情</span>
                        </button>
                        <button className="flex items-center space-x-2 text-green-600 hover:text-green-700">
                          <Play className="w-4 h-4" />
                          <span>开始训练</span>
                        </button>
                        <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-700">
                          <Edit className="w-4 h-4" />
                          <span>编辑</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <Brain className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  创建AI个性化训练计划
                </h2>
                <p className="text-gray-600">
                  基于您的健身目标和个人情况，AI将为您生成专属的训练计划
                </p>
              </div>

              <div className="space-y-8">
                {/* 训练目标 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">训练目标</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.map((goal) => (
                      <div
                        key={goal.id}
                        onClick={() => setFormData({ ...formData, goal: goal.id })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.goal === goal.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{goal.icon}</div>
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 训练水平 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">训练水平</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {levels.map((level) => (
                      <div
                        key={level.id}
                        onClick={() => setFormData({ ...formData, level: level.id })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.level === level.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <h4 className="font-medium text-gray-900">{level.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{level.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 训练重点 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">训练重点</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {focusAreas.map((focus) => (
                      <div
                        key={focus.id}
                        onClick={() => setFormData({ ...formData, focus: focus.id })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.focus === focus.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{focus.icon}</div>
                        <h4 className="font-medium text-gray-900">{focus.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">{focus.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 训练安排 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      训练周期（周）
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="4">4周</option>
                      <option value="6">6周</option>
                      <option value="8">8周</option>
                      <option value="12">12周</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      训练频率（次/周）
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="3">3次/周</option>
                      <option value="4">4次/周</option>
                      <option value="5">5次/周</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      每次训练时长（分钟）
                    </label>
                    <select
                      value={formData.time_per_session}
                      onChange={(e) => setFormData({ ...formData, time_per_session: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="30">30分钟</option>
                      <option value="45">45分钟</option>
                      <option value="60">60分钟</option>
                      <option value="90">90分钟</option>
                    </select>
                  </div>
                </div>

                {/* 可用器械 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">可用器械</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {equipmentOptions.map((equipment) => (
                      <div
                        key={equipment.id}
                        onClick={() => setFormData({ ...formData, equipment: equipment.id })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.equipment === equipment.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <h4 className="font-medium text-gray-900">{equipment.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{equipment.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 特殊要求 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      身体限制或伤病史
                    </label>
                    <textarea
                      value={formData.limitations}
                      onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="请描述任何身体限制、伤病史或需要特别注意的事项..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      具体目标描述
                    </label>
                    <textarea
                      value={formData.specific_goals}
                      onChange={(e) => setFormData({ ...formData, specific_goals: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="请详细描述您的训练目标，例如：引体向上从0个到10个..."
                    />
                  </div>
                </div>

                {/* 生成按钮 */}
                <div className="text-center">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                      isGenerating
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <Activity className="w-5 h-5 animate-spin" />
                        <span>AI生成中...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Brain className="w-5 h-5" />
                        <span>生成训练计划</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITrainingPlanService; 