import React, { useState } from 'react';
import { Brain, Target, Clock, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthService } from '../services/authService';
import { TrainingService } from '../services/trainingService';

interface AITrainingGeneratorProps {
  onGenerate: (plan: any) => void;
  isLoading?: boolean;
}

const AITrainingGenerator: React.FC<AITrainingGeneratorProps> = ({ onGenerate, isLoading = false }) => {
  const [formData, setFormData] = useState({
    goal: '',
    level: '',
    duration: '4',
    focus: '',
    equipment: '',
    timePerSession: '30'
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const goals = [
    { id: 'strength', name: '力量增强', icon: '💪' },
    { id: 'endurance', name: '耐力提升', icon: '🏃' },
    { id: 'muscle', name: '肌肉增长', icon: '🏋️' },
    { id: 'weight_loss', name: '减脂塑形', icon: '🔥' },
    { id: 'flexibility', name: '柔韧性', icon: '🤸' },
    { id: 'overall', name: '综合健身', icon: '⚡' }
  ];

  const levels = [
    { id: 'beginner', name: '初学者', description: '刚开始健身或运动经验较少' },
    { id: 'intermediate', name: '中级', description: '有一定健身基础，能完成基本动作' },
    { id: 'advanced', name: '高级', description: '有丰富健身经验，追求更高挑战' }
  ];

  const focusAreas = [
    { id: 'upper_body', name: '上肢训练', icon: '💪' },
    { id: 'lower_body', name: '下肢训练', icon: '🦵' },
    { id: 'core', name: '核心训练', icon: '🎯' },
    { id: 'full_body', name: '全身训练', icon: '🏃' },
    { id: 'cardio', name: '有氧训练', icon: '❤️' },
    { id: 'functional', name: '功能性训练', icon: '⚡' }
  ];

  const equipmentOptions = [
    { id: 'none', name: '徒手训练', icon: '🤲' },
    { id: 'basic', name: '基础器械', icon: '🏋️', description: '哑铃、弹力带等' },
    { id: 'gym', name: '健身房', icon: '🏢', description: '完整健身房设备' },
    { id: 'home', name: '家庭器械', icon: '🏠', description: '简单家用设备' }
  ];

  const handleGenerate = async () => {
    // 验证表单
    if (!formData.goal || !formData.level || !formData.focus) {
      setMessage({ type: 'error', text: '请填写完整的训练需求信息' });
      return;
    }

    // 获取当前用户
    const authService = AuthService.getInstance();
    const authState = authService.getAuthState();
    
    if (!authState.user) {
      setMessage({ type: 'error', text: '请先登录后再生成训练计划' });
      return;
    }

    setMessage({ type: 'info', text: '正在为您生成个性化训练计划...' });

    try {
      // 调用真实的AI训练计划生成API
      const trainingService = TrainingService.getInstance();
      const plan = await trainingService.generateAITrainingPlan(authState.user.id, {
        goal: formData.goal,
        level: formData.level,
        focus: formData.focus,
        equipment: formData.equipment,
        duration: parseInt(formData.duration),
        timePerSession: parseInt(formData.timePerSession)
      });

      if (plan) {
        setMessage({ type: 'success', text: '智能训练计划生成成功！' });
        // 传递训练计划数据给父组件
        onGenerate(plan);
      } else {
        setMessage({ type: 'error', text: '智能训练计划生成失败，请稍后重试' });
      }
    } catch (error) {
      console.error('生成智能训练计划失败:', error);
      setMessage({ type: 'error', text: '生成训练计划时发生错误，请稍后重试' });
    }
  };

  const generateMockExercises = (data: any) => {
    const exercises = {
      upper_body: [
        { name: '俯卧撑', sets: 3, reps: '8-12', rest_time: 60, category: '胸部' },
        { name: '引体向上', sets: 3, reps: '5-8', rest_time: 90, category: '背部' },
        { name: '臂屈伸', sets: 3, reps: '8-10', rest_time: 60, category: '手臂' }
      ],
      lower_body: [
        { name: '深蹲', sets: 3, reps: '12-15', rest_time: 60, category: '腿部' },
        { name: '弓步蹲', sets: 3, reps: '10-12', rest_time: 45, category: '腿部' },
        { name: '单腿硬拉', sets: 3, reps: '8-10', rest_time: 60, category: '腿部' }
      ],
      core: [
        { name: '平板支撑', sets: 3, reps: '30-60秒', rest_time: 45, category: '核心' },
        { name: '卷腹', sets: 3, reps: '15-20', rest_time: 30, category: '核心' },
        { name: '俄罗斯转体', sets: 3, reps: '20-30', rest_time: 45, category: '核心' }
      ]
    };

    return exercises[data.focus as keyof typeof exercises] || exercises.upper_body;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      {/* 头部 */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">智能训练计划生成</h2>
        <p className="text-gray-600">告诉我们您的需求，系统将为您量身定制专属训练方案</p>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-8">
        {/* 训练目标 */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 mb-4">
            <Target className="w-5 h-5 inline mr-2" />
            您的训练目标是什么？
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setFormData(prev => ({ ...prev, goal: goal.id }))}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  formData.goal === goal.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{goal.icon}</div>
                <div className="font-medium text-gray-900">{goal.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 健身水平 */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 mb-4">
            您的健身水平如何？
          </label>
          <div className="space-y-3">
            {levels.map((level) => (
              <button
                key={level.id}
                onClick={() => setFormData(prev => ({ ...prev, level: level.id }))}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  formData.level === level.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900 mb-1">{level.name}</div>
                <div className="text-sm text-gray-600">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 训练重点 */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 mb-4">
            您希望重点训练哪个部位？
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {focusAreas.map((area) => (
              <button
                key={area.id}
                onClick={() => setFormData(prev => ({ ...prev, focus: area.id }))}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  formData.focus === area.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{area.icon}</div>
                <div className="font-medium text-gray-900">{area.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 器械条件 */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 mb-4">
            您可以使用什么器械？
          </label>
          <div className="grid grid-cols-2 gap-3">
            {equipmentOptions.map((equipment) => (
              <button
                key={equipment.id}
                onClick={() => setFormData(prev => ({ ...prev, equipment: equipment.id }))}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  formData.equipment === equipment.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{equipment.icon}</div>
                <div className="font-medium text-gray-900 mb-1">{equipment.name}</div>
                {equipment.description && (
                  <div className="text-sm text-gray-600">{equipment.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 时间设置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              <Clock className="w-5 h-5 inline mr-2" />
              训练周期
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="2">2周 - 快速体验</option>
              <option value="4">4周 - 标准计划</option>
              <option value="8">8周 - 深度训练</option>
              <option value="12">12周 - 长期改变</option>
            </select>
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              每次训练时长
            </label>
            <select
              value={formData.timePerSession}
              onChange={(e) => setFormData(prev => ({ ...prev, timePerSession: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="15">15分钟 - 快速训练</option>
              <option value="30">30分钟 - 标准训练</option>
              <option value="45">45分钟 - 深度训练</option>
              <option value="60">60分钟 - 完整训练</option>
            </select>
          </div>
        </div>

        {/* 生成按钮 */}
        <div className="text-center pt-4">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>智能生成中...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Zap className="w-6 h-6" />
                <span>生成我的专属计划</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AITrainingGenerator;