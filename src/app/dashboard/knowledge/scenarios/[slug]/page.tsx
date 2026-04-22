'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Clock, CheckCircle } from 'lucide-react';

type ScenarioStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  duration_seconds: number;
  video_url?: string;
  image_url?: string;
};

type Scenario = {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  duration_minutes: number;
  steps: ScenarioStep[];
};

// Hardcoded sample scenarios for demo
const SAMPLE_SCENARIOS: Record<string, Scenario> = {
  'office-neck': {
    id: '1',
    title: '办公族肩颈救星',
    slug: 'office-neck',
    description: '久坐办公后的肩颈放松方案，5分钟快速缓解',
    icon: '💼',
    duration_minutes: 5,
    steps: [
      { id: '1', order: 1, title: '颈部前后屈伸', description: '轻轻低头，下巴靠近胸口，保持3秒；然后慢慢抬头向后仰，保持3秒', duration_seconds: 30 },
      { id: '2', order: 2, title: '颈部左右侧屈', description: '左耳尽量靠近左肩，保持15秒；换右侧重复', duration_seconds: 30 },
      { id: '3', order: 3, title: '颈部旋转', description: '缓慢顺时针转动头部一圈，再逆时针转动一圈', duration_seconds: 30 },
      { id: '4', order: 4, title: '耸肩放松', description: '双肩尽量向上耸，保持5秒后放松，重复5次', duration_seconds: 30 },
      { id: '5', order: 5, title: '肩部环绕', description: '双臂自然下垂，肩部向前画圈5次，再向后画圈5次', duration_seconds: 30 },
      { id: '6', order: 6, title: '胸椎伸展', description: '双手交叉放头后，胸部向上挺起，眼睛看天花板，保持10秒', duration_seconds: 30 },
    ],
  },
  'sitting-back': {
    id: '2',
    title: '久坐腰痛缓解',
    slug: 'sitting-back',
    description: '针对久坐导致的腰背不适，站立或坐姿均可完成',
    icon: '🪑',
    duration_minutes: 6,
    steps: [
      { id: '1', order: 1, title: '骨盆前后倾', description: '坐姿，交替做骨盆前倾（翘臀）和后倾（收腹）动作，各10次', duration_seconds: 60 },
      { id: '2', order: 2, title: '猫牛式伸展', description: '双手撑地，交替做拱背（猫式）和塌腰（牛式），各8次', duration_seconds: 60 },
      { id: '3', order: 3, title: '坐姿扭转', description: '坐姿，右手放左膝外侧，左手放身后，扭转躯干15秒；换边重复', duration_seconds: 60 },
      { id: '4', order: 4, title: '髋屈肌拉伸', description: '弓步位，后腿膝盖着地，前推髋部感受大腿前侧拉伸，每侧30秒', duration_seconds: 60 },
      { id: '5', order: 5, title: '仰卧抱膝', description: '仰卧，双手抱膝拉向胸口，保持30秒', duration_seconds: 30 },
      { id: '6', order: 6, title: '腿部交叉拉伸', description: '仰卧，右脚踝放左膝上，双手抱左大腿拉向胸口，每侧30秒', duration_seconds: 60 },
    ],
  },
  'post-run': {
    id: '3',
    title: '跑步后拉伸',
    slug: 'post-run',
    description: '跑步训练后的下肢放松与恢复方案',
    icon: '🏃',
    duration_minutes: 8,
    steps: [
      { id: '1', order: 1, title: '股四头肌拉伸', description: '站立单腿后勾，手抓脚踝拉向臀部，每侧30秒', duration_seconds: 60 },
      { id: '2', order: 2, title: '腘绳肌拉伸', description: '单腿前伸脚跟着地，身体前倾感受大腿后侧拉伸，每侧30秒', duration_seconds: 60 },
      { id: '3', order: 3, title: '小腿拉伸', description: '面墙弓步，后腿伸直脚跟着地，前推身体，每侧30秒', duration_seconds: 60 },
      { id: '4', order: 4, title: '髂胫束放松', description: '站立交叉腿，向外侧侧身延展，每侧30秒', duration_seconds: 60 },
      { id: '5', order: 5, title: '髋屈肌拉伸', description: '弓步跪姿，前推髋部，每侧45秒', duration_seconds: 90 },
      { id: '6', order: 6, title: '臀肌拉伸', description: '坐姿4字腿，身体前倾，每侧45秒', duration_seconds: 90 },
    ],
  },
  'bedtime': {
    id: '4',
    title: '睡前放松',
    slug: 'bedtime',
    description: '帮助放松身心，提高睡眠质量的轻柔伸展',
    icon: '😴',
    duration_minutes: 10,
    steps: [
      { id: '1', order: 1, title: '颈部放松', description: '缓慢转动头部，左右各5圈', duration_seconds: 60 },
      { id: '2', order: 2, title: '肩部放松', description: '耸肩保持5秒后放松，重复8次', duration_seconds: 60 },
      { id: '3', order: 3, title: '婴儿式', description: '跪坐，双臂向前延伸趴下，放松呼吸1分钟', duration_seconds: 90 },
      { id: '4', order: 4, title: '仰卧扭转', description: '仰卧，双膝并拢倒向一侧，保持30秒换边', duration_seconds: 90 },
      { id: '5', order: 5, title: '仰卧蝴蝶式', description: '仰卧，脚底相对，膝盖自然外展，放松1分钟', duration_seconds: 90 },
      { id: '6', order: 6, title: '腿靠墙', description: '仰卧双腿靠墙垂直向上，放松呼吸2分钟', duration_seconds: 120 },
    ],
  },
};

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    // For demo, use hardcoded data
    const data = SAMPLE_SCENARIOS[slug];
    if (data) {
      setScenario(data);
    }
    setLoading(false);
  }, [slug]);

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    // Auto-advance to next step
    if (scenario && currentStepIndex !== null && currentStepIndex < scenario.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setCurrentStepIndex(null);
    }
  };

  const startFlow = () => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center py-20">
          <p className="text-surface-500">场景不存在</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-500">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-4 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-surface-900 dark:text-surface-100">
              {scenario.icon} {scenario.title}
            </h1>
            <p className="text-xs text-surface-500">
              约 {scenario.duration_minutes} 分钟
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {/* Description */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">{scenario.description}</p>
        </div>

        {/* Start Button */}
        {currentStepIndex === null && (
          <button
            onClick={startFlow}
            className="w-full flex items-center justify-center gap-3 bg-primary-500 hover:bg-primary-600 text-white py-4 rounded-xl font-bold text-lg transition-colors"
          >
            <Play size={24} />
            <span>开始练习</span>
          </button>
        )}

        {/* Current Step (Active) */}
        {currentStepIndex !== null && scenario.steps[currentStepIndex] && (
          <div className="bg-primary-500 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-white/80 text-sm">
              <Clock size={16} />
              <span>{scenario.steps[currentStepIndex].duration_seconds}秒</span>
            </div>
            <h2 className="text-xl font-black mb-3">
              第 {currentStepIndex + 1} 步：{scenario.steps[currentStepIndex].title}
            </h2>
            <p className="text-white/90 leading-relaxed">
              {scenario.steps[currentStepIndex].description}
            </p>
            <button
              onClick={() => handleStepComplete(scenario.steps[currentStepIndex].id)}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 py-3 rounded-xl font-bold transition-colors"
            >
              <CheckCircle size={20} />
              <span>完成此步骤</span>
            </button>
          </div>
        )}

        {/* Steps List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-surface-500">全部步骤</h3>
          {scenario.steps.map((step, idx) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = currentStepIndex === idx;
            
            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                    : isCompleted
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700'
                }`}
              >
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold ${isCurrent ? 'text-primary-700 dark:text-primary-300' : 'text-surface-800 dark:text-surface-200'}`}>
                    {step.title}
                  </h4>
                  <p className="text-xs text-surface-500 mt-1 line-clamp-2">{step.description}</p>
                </div>
                <span className="text-xs text-surface-400 shrink-0">{step.duration_seconds}秒</span>
              </div>
            );
          })}
        </div>

        {/* Completion Message */}
        {completedSteps.size === scenario.steps.length && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-black text-green-700 dark:text-green-300 text-lg">练习完成！</h3>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">坚持下去，你会越来越好</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-6 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
            >
              返回知识库
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
