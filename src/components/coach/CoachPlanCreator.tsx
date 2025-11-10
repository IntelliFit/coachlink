import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePlanByCoachRules } from '../services/planEngine';
import AIEnhancementService from '../services/aiEnhancementService';
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
  X,
  Plus,
  Trash2,
  Save,
  Send
} from 'lucide-react';

interface CoachPlanCreatorProps {
  coachId: string;
  studentId: string;
  studentName: string;
  onBack: () => void;
  onPlanCreated: (planId: string) => void;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  load_type?: '%1RM' | 'bodyweight' | 'assisted' | 'absolute_kg';
  load_value?: number;
  tempo?: string;
  pause?: string;
  rest_sec?: number;
  notes?: string;
}

interface TrainingSession {
  day: string;
  focus: string;
  main: Exercise[];
  accessories: Exercise[];
  notes?: string;
}

interface TrainingWeek {
  week: number;
  sessions: TrainingSession[];
}

interface TrainingPlan {
  meta: {
    title: string;
    duration_weeks: number;
    frequency_per_week: number;
    goal: string;
    experience_level: string;
    global_warmup: Exercise[];
    cooldown: { name: string; duration_min: number }[];
    safety_notes: string[];
  };
  weeks: TrainingWeek[];
}

const CoachPlanCreator: React.FC<CoachPlanCreatorProps> = ({
  coachId,
  studentId,
  studentName,
  onBack,
  onPlanCreated
}) => {
  const [currentStep, setCurrentStep] = useState<'load_student' | 'plan_editor' | 'preview'>('load_student');
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [planData, setPlanData] = useState<TrainingPlan>({
    meta: {
      title: '个性化训练计划',
      duration_weeks: 6,
      frequency_per_week: 3,
      goal: '力量提升',
      experience_level: 'intermediate',
      global_warmup: [
        { name: '弹力带宽拉', sets: 1, reps: '10-15', rest_sec: 30, notes: '激活背部肌群' },
        { name: '木棍绕肩', sets: 1, reps: '10-15', rest_sec: 30, notes: '肩部活动度' }
      ],
      cooldown: [
        { name: '肩袖松解', duration_min: 5 },
        { name: '背部拉伸', duration_min: 5 }
      ],
      safety_notes: ['确保动作标准', '循序渐进增加负重', '注意休息充分']
    },
    weeks: []
  });
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const domains = [
    { id: 'weighted_pullup', name: '负重引体', description: '专注于引体向上的力量发展' },
    { id: 'weighted_dips', name: '负重臂屈伸', description: '专注于臂屈伸的力量发展' },
    { id: 'combo', name: '引体+臂屈伸组合', description: '推拉动作的综合训练' }
  ];

  const levels = [
    { id: 'beginner', name: '初学者', description: '0-6个月经验，基础动作学习' },
    { id: 'intermediate', name: '中级', description: '6个月-2年经验，技巧提升' },
    { id: 'advanced', name: '高级', description: '2年以上经验，高强度训练' }
  ];

  // 加载学员档案
  useEffect(() => {
    loadStudentProfile();
  }, [studentId]);

  const loadStudentProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-student-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: studentId })
      });

      if (response.ok) {
        const result = await response.json();
        setStudentProfile(result.data);
        
        // 基于学员信息初始化计划基础数据
        if (result.data?.questionnaire) {
          const answers = result.data.questionnaire.answers;
          setPlanData(prev => ({
            ...prev,
            meta: {
              ...prev.meta,
              frequency_per_week: answers.weekly_frequency || 3,
              experience_level: answers.level || 'intermediate',
              goal: answers.specific_goal || '力量提升'
            }
          }));
        }
        
        setCurrentStep('plan_editor');
      } else {
        setMessage({ type: 'error', text: '加载学员档案失败' });
      }
    } catch (error) {
      console.error('加载学员档案失败:', error);
      setMessage({ type: 'error', text: '加载学员档案失败' });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAISuggestion = async () => {
    if (!studentProfile?.questionnaire) {
      setMessage({ type: 'error', text: '学员信息不完整，无法生成AI建议' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: 'info', text: 'AI正在基于学员档案生成建议...' });

    try {
      const answers = studentProfile.questionnaire.answers;
      const input = {
        userId: studentId,
        coachId: coachId,
        goal: 'strength',
        level: answers.level || 'intermediate',
        focus: 'upper',
        duration_weeks: 6,
        frequency_per_week: answers.weekly_frequency || 3,
        time_per_session: answers.session_duration || 60,
        domain: answers.domain || 'combo',
        assessment_data: answers,
        weekly_frequency: answers.weekly_frequency || 3,
        session_duration: answers.session_duration || 60,
        available_days: answers.available_days || ['Mon', 'Wed', 'Fri'],
        equipment: answers.equipment || [],
        intensity_preference: answers.intensity_preference || 'balanced',
        rest_policy: answers.rest_policy || 'medium',
        injuries: answers.injuries,
        specific_goal: answers.specific_goal
      };

      // 生成AI建议计划
      const suggestedPlan = await generatePlanByCoachRules(input);
      
      // 将AI建议应用到当前计划数据
      setPlanData(suggestedPlan);
      setMessage({ type: 'success', text: 'AI建议已生成，您可以基于此进行调整' });
    } catch (error) {
      console.error('生成AI建议失败:', error);
      setMessage({ type: 'error', text: '生成AI建议失败，请手动制定计划' });
    } finally {
      setIsLoading(false);
    }
  };

  const publishPlan = async () => {
    try {
      if (!planData || planData.weeks.length === 0) {
        setMessage({ type: 'error', text: '请先制定训练计划内容' });
        return;
      }

      setIsLoading(true);
      setMessage({ type: 'info', text: '正在发布训练计划...' });

      // 构造计划详情
      const planDetails: any[] = [];
      planData.weeks.forEach((week: any) => {
        week.sessions.forEach((session: any, idx: number) => {
          planDetails.push({
            week_number: week.week,
            day_of_week: session.day,
            session_focus: session.focus,
            main_exercises: session.main,
            accessory_exercises: session.accessories,
            warmup: planData.meta.global_warmup,
            cooldown: planData.meta.cooldown,
            notes: session.notes || planData.meta.safety_notes?.join('\n'),
            order_index: idx
          });
        });
      });

      // 1) 创建草稿计划
      const draftRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-plan-draft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coach_id: coachId,
          student_id: studentId,
          title: planData.meta.title,
          description: `${planData.meta.duration_weeks}周 / 每周${planData.meta.frequency_per_week}次`,
          difficulty_level: planData.meta.experience_level,
          duration_weeks: planData.meta.duration_weeks,
          domain: studentProfile?.questionnaire?.answers?.domain || 'combo',
          assessment_data: studentProfile?.questionnaire?.answers || {},
          ai_generated: false,
          enhanced_by_ai: false
        })
      });

      if (!draftRes.ok) throw new Error('创建计划草稿失败');
      const draftJson = await draftRes.json();
      const planId = draftJson?.data?.id as string;
      if (!planId) throw new Error('创建草稿返回无计划ID');

      // 2) 发布计划并写入详情
      const publishRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-training-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          training_plan_id: planId,
          coach_id: coachId,
          details: planDetails
        })
      });
      if (!publishRes.ok) throw new Error('发布训练计划失败');

      setMessage({ type: 'success', text: '训练计划已成功发布给学员！' });
      setTimeout(() => {
        onPlanCreated(planId);
      }, 2000);
    } catch (error) {
      console.error('发布计划失败:', error);
      setMessage({ type: 'error', text: '发布计划失败，请重试' });
    } finally {
      setIsLoading(false);
    }
  };

  // 已简化，清理了无用函数

  const renderStep = () => {
    switch (currentStep) {
      case 'load_student':
        return (
          <div className="text-center space-y-6">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">正在加载学员档案...</h3>
              <p className="text-gray-600">请稍候，正在获取 {studentName} 的详细信息</p>
            </div>
          </div>
        );
      
      case 'plan_editor':
        return renderPlanEditor();
      
      case 'preview':
        return renderPreview();
      
      default:
        return null;
    }
  };

  const renderPlanEditor = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">学员信息概览</h3>
        {studentProfile && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">姓名：</span>
              <span>{studentName}</span>
            </div>
            <div>
              <span className="font-medium">水平：</span>
              <span>{studentProfile.questionnaire?.answers?.level || '未知'}</span>
            </div>
            <div>
              <span className="font-medium">频率：</span>
              <span>{studentProfile.questionnaire?.answers?.weekly_frequency || 3}次/周</span>
            </div>
            <div>
              <span className="font-medium">目标：</span>
              <span>{studentProfile.questionnaire?.answers?.specific_goal || '力量提升'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">制定训练计划</h3>
          <div className="flex space-x-3">
            <button
              onClick={generateAISuggestion}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? '生成中...' : 'AI辅助建议'}
            </button>
            <button
              onClick={publishPlan}
              disabled={isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? '发布中...' : '发布计划'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' :
            message.type === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            <span>{message.text}</span>
          </div>
        )}

        <div className="text-center py-8 text-gray-500">
          <p>简化版编辑器 - 功能开发中</p>
          <p className="text-sm mt-2">点击"AI辅助建议"生成基础计划模板，然后可以发布给学员</p>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">计划预览</h3>
        <p className="text-gray-600">预览功能开发中...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">制定训练计划</h1>
                <p className="text-gray-600">为学员 {studentName} 创建个性化训练计划</p>
              </div>
            </div>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[
                { key: 'load_student', name: '加载档案', icon: User },
                { key: 'plan_editor', name: '制定计划', icon: Edit },
                { key: 'preview', name: '预览发布', icon: Eye },
              ].map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.key;
                const isCompleted = (currentStep === 'plan_editor' && index === 0) || 
                                   (currentStep === 'preview' && index < 2);
                
                return (
                  <div key={step.key} className="flex items-center space-x-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-blue-600 text-white' :
                      isCompleted ? 'bg-green-600 text-white' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      isActive ? 'text-blue-600' :
                      isCompleted ? 'text-green-600' :
                      'text-gray-500'
                    }`}>
                      {step.name}
                    </span>
                    {index < 2 && (
                      <div className={`w-16 h-0.5 ${
                        isCompleted ? 'bg-green-600' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 内容区域 */}
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default CoachPlanCreator;


