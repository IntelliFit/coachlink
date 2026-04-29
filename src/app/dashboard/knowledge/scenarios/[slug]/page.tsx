'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Clock, CheckCircle } from 'lucide-react';

type ScenarioStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  duration_seconds: number;
  image_url: string;
};

type Scenario = {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  duration_minutes: number;
  cover_image_url: string;
  steps: ScenarioStep[];
};

const SAMPLE_SCENARIOS: Record<string, Scenario> = {
  'office-neck': {
    id: '1',
    title: '办公后肩颈放松',
    slug: 'office-neck',
    description: '适合久坐办公、低头看电脑后肩颈发紧的时候。用几步温和动作把后颈、肩侧和上背慢慢放松开。',
    icon: '🪑',
    duration_minutes: 5,
    cover_image_url: '/images/toolbox-scenarios/first-aid-1.png',
    steps: [
      {
        id: '1',
        order: 1,
        title: '坐姿下巴微收',
        description: '坐稳后把头顶轻轻向上延展，下巴微微回收，不要低头含胸。感受后颈像被轻轻拉长一样，呼吸保持放松。',
        duration_seconds: 90,
        image_url: '/images/toolbox-scenarios/first-aid-1.png',
      },
      {
        id: '2',
        order: 2,
        title: '颈侧轻柔拉伸',
        description: '头部慢慢倒向一侧，另一边肩膀保持下沉，不要跟着抬起。停留时只要有轻微拉伸感就够了，换边时也保持慢慢来。',
        duration_seconds: 90,
        image_url: '/images/toolbox-scenarios/first-aid-2.png',
      },
      {
        id: '3',
        order: 3,
        title: '肩部后绕放松',
        description: '双肩向上、向后、再向下缓慢绕环，把动作做圆但不要做快。重点是把肩颈的紧绷感一点点卸下来。',
        duration_seconds: 120,
        image_url: '/images/toolbox-scenarios/first-aid-3.png',
      },
    ],
  },
  'sitting-back': {
    id: '2',
    title: '久坐后腰背舒展',
    slug: 'sitting-back',
    description: '适合久坐之后腰背发僵、起身时觉得身体打不开的时候。先把背部延展开，再做温和活动和收尾放松。',
    icon: '🧘',
    duration_minutes: 6,
    cover_image_url: '/images/toolbox-scenarios/first-aid-4.png',
    steps: [
      {
        id: '1',
        order: 1,
        title: '站姿扶桌延展',
        description: '双手扶稳支撑面，慢慢把髋部向后送出去，让手臂和背部自然拉长。不要塌腰，用“拉长”而不是“硬压”的感觉开始。',
        duration_seconds: 120,
        image_url: '/images/toolbox-scenarios/first-aid-4.png',
      },
      {
        id: '2',
        order: 2,
        title: '猫牛式舒展',
        description: '四点支撑后，随着呼吸慢慢拱背、再慢慢回到伸展位。动作范围不用很大，重点是让整条脊柱重新活动起来。',
        duration_seconds: 120,
        image_url: '/images/toolbox-scenarios/first-aid-5.png',
      },
      {
        id: '3',
        order: 3,
        title: '仰卧抱膝放松',
        description: '躺下后把膝盖轻轻带向身体，手臂只是辅助，不要用力猛拉。让下背部慢慢松下来，呼吸越平稳越好。',
        duration_seconds: 120,
        image_url: '/images/toolbox-scenarios/first-aid-6.png',
      },
    ],
  },
  'post-run': {
    id: '3',
    title: '跑步后下肢拉伸',
    slug: 'post-run',
    description: '适合跑步、跳绳或下肢训练后做恢复。按顺序放松小腿、大腿前侧和髋臀区域，让腿部紧绷感慢慢退下来。',
    icon: '🏃',
    duration_minutes: 8,
    cover_image_url: '/images/toolbox-scenarios/first-aid-7.png',
    steps: [
      {
        id: '1',
        order: 1,
        title: '小腿后侧拉伸',
        description: '弓步站稳后让后脚脚跟贴地，身体轻轻往前送一点。你应该感觉到小腿后侧被拉开，而不是脚踝被硬顶住。',
        duration_seconds: 150,
        image_url: '/images/toolbox-scenarios/first-aid-7.png',
      },
      {
        id: '2',
        order: 2,
        title: '大腿前侧拉伸',
        description: '先扶稳再拉伸，轻轻把脚跟带向臀部，膝盖尽量朝下。重点放在大腿前侧的舒展感，不要为了拉更深而扭腰。',
        duration_seconds: 150,
        image_url: '/images/toolbox-scenarios/first-aid-8.png',
      },
      {
        id: '3',
        order: 3,
        title: '臀部与髋部放松',
        description: '进入臀部和髋部的放松姿势后，先找到稳定，再慢慢加一点点幅度。只保留温和拉伸感，不需要追求压到底。',
        duration_seconds: 180,
        image_url: '/images/toolbox-scenarios/first-aid-9.png',
      },
    ],
  },
  bedtime: {
    id: '4',
    title: '睡前放松',
    slug: 'bedtime',
    description: '适合睡前十分钟做个简单收尾，把呼吸、背部和神经状态一起慢慢放下来，让身体更容易进入休息节奏。',
    icon: '🌙',
    duration_minutes: 10,
    cover_image_url: '/images/toolbox-scenarios/first-aid-10.png',
    steps: [
      {
        id: '1',
        order: 1,
        title: '仰卧腹式呼吸',
        description: '平躺后把注意力放到呼吸上，吸气时感受腹部轻轻鼓起，呼气时慢慢落下。先不要着急拉伸，先把节奏放慢。',
        duration_seconds: 180,
        image_url: '/images/toolbox-scenarios/first-aid-10.png',
      },
      {
        id: '2',
        order: 2,
        title: '仰卧扭转舒展',
        description: '双膝并拢倒向一侧时，肩膀尽量保持放松，不需要为了贴地而强压。让腰背和侧腰在呼吸里慢慢打开就可以。',
        duration_seconds: 180,
        image_url: '/images/toolbox-scenarios/first-aid-11.png',
      },
      {
        id: '3',
        order: 3,
        title: '婴儿式放松',
        description: '最后用一个更安静的姿势收尾，臀部坐回脚跟，手臂向前延展，背部自然松下来。让身体知道现在可以慢慢休息了。',
        duration_seconds: 240,
        image_url: '/images/toolbox-scenarios/first-aid-12.png',
      },
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
    const data = SAMPLE_SCENARIOS[slug];
    if (data) {
      setScenario(data);
    }
    setLoading(false);
  }, [slug]);

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
    if (scenario && currentStepIndex !== null && currentStepIndex < scenario.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      return;
    }
    setCurrentStepIndex(null);
  };

  const startFlow = () => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen p-4">
        <div className="py-20 text-center">
          <p className="text-surface-500">场景不存在</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-500">
            返回
          </button>
        </div>
      </div>
    );
  }

  const currentStep = currentStepIndex !== null ? scenario.steps[currentStepIndex] : null;

  return (
    <div className="min-h-screen pb-32">
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50/80 backdrop-blur-lg dark:border-surface-700 dark:bg-surface-900/80">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl p-2 -ml-2 text-surface-600 transition-colors hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-surface-900 dark:text-surface-100">
              {scenario.icon} {scenario.title}
            </h1>
            <p className="text-xs text-surface-500">约 {scenario.duration_minutes} 分钟</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={scenario.cover_image_url}
              alt={scenario.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
          <div className="border-t border-surface-100 bg-amber-50 p-4 text-sm text-amber-900 dark:border-surface-700 dark:bg-amber-900/20 dark:text-amber-200">
            {scenario.description}
          </div>
        </div>

        {currentStepIndex === null && (
          <button
            onClick={startFlow}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary-500 py-4 text-lg font-bold text-white transition-colors hover:bg-primary-600"
          >
            <Play size={24} />
            <span>开始跟练</span>
          </button>
        )}

        {currentStep && (
          <div className="overflow-hidden rounded-2xl bg-primary-500 text-white shadow-lg">
            <div className="relative aspect-[4/3] w-full bg-primary-400/30">
              <Image
                src={currentStep.image_url}
                alt={currentStep.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
                <Clock size={16} />
                <span>{currentStep.duration_seconds} 秒</span>
              </div>
              <h2 className="mb-3 text-xl font-black">
                第 {currentStepIndex + 1} 步：{currentStep.title}
              </h2>
              <p className="leading-relaxed text-white/90">{currentStep.description}</p>
              <button
                onClick={() => handleStepComplete(currentStep.id)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 py-3 font-bold transition-colors hover:bg-white/30"
              >
                <CheckCircle size={20} />
                <span>完成这一步</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-surface-500">全部步骤</h3>
          {scenario.steps.map((step, idx) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = currentStepIndex === idx;

            return (
              <div
                key={step.id}
                className={`overflow-hidden rounded-2xl transition-all ${
                  isCurrent
                    ? 'border-2 border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                    : isCompleted
                      ? 'border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800'
                }`}
              >
                <div className="flex items-start gap-4 p-4">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`font-bold ${
                        isCurrent ? 'text-primary-700 dark:text-primary-300' : 'text-surface-800 dark:text-surface-200'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p className="mt-1 text-xs text-surface-500">{step.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-surface-400">{step.duration_seconds} 秒</span>
                </div>
                <div className="relative aspect-[16/9] w-full border-t border-surface-100 dark:border-surface-700">
                  <Image
                    src={step.image_url}
                    alt={step.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 768px"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {completedSteps.size === scenario.steps.length && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
            <div className="mb-3 text-4xl">🎉</div>
            <h3 className="text-lg font-black text-green-700 dark:text-green-300">练习完成</h3>
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">今天先做到这里，身体放松一点就很好。</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-xl bg-green-500 px-6 py-2 font-bold text-white transition-colors hover:bg-green-600"
            >
              返回工具箱
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
