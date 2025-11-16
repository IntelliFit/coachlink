import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePlanByCoachRules, EnhancedPlanInput } from '../services/planEngine';
import AIEnhancementService from '../services/aiEnhancementService';
import ActionDomainSelector from './ActionDomainSelector';
import AssessmentForm from './AssessmentForm';
import TrainingPlanPreview from './TrainingPlanPreview';
import {
    Brain,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    Zap
} from 'lucide-react';
import { studentService } from '../services/studentService';
import { VideoService } from '../services/videoService';

interface EnhancedAITrainingGeneratorProps {
    coachId: string;
    onBack?: () => void;
    onPlanGenerated?: (plan: any) => void;
}

const EnhancedAITrainingGenerator: React.FC<EnhancedAITrainingGeneratorProps> = ({
    coachId,
    onBack,
    onPlanGenerated
}) => {
    const [currentStep, setCurrentStep] = useState<'domain' | 'assessment' | 'choose_generation' | 'preview' | 'generated'>('domain');
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [assessmentData, setAssessmentData] = useState<any>(null);
    const [ruleEnginePlan, setRuleEnginePlan] = useState<any>(null);
    const [enhancedPlan, setEnhancedPlan] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [useAIEnhancement, setUseAIEnhancement] = useState(true);
    const [message, setMessage] = useState<{
        type: 'success' | 'error' | 'info';
        text: string;
    } | null>(null);

    const handleDomainSelect = (domain: string) => {
        setSelectedDomain(domain);
        setCurrentStep('assessment');
    };

    const handleAssessmentSubmit = async (data: any) => {
        setAssessmentData(data);

        try {
            const userId = localStorage.getItem('current_user_id') || '';
            const videoService = VideoService.getInstance();

            // 1) 上传基线视频文件（如果有）
            const uploadedUrls: string[] = [];
            if (Array.isArray(data.baseline_files) && data.baseline_files.length > 0) {
                for (const file of data.baseline_files as File[]) {
                    try {
                        const res = await videoService.submitVideoFile({ userId, file, purpose: 'baseline' });
                        if (res?.video_url) uploadedUrls.push(res.video_url);
                    } catch (e) {
                        console.warn('基线视频文件上传失败，已跳过:', e);
                    }
                }
            }

            // 2) 合并URL（文本框粘贴的 + 文件上传返回的）
            const allUrls = [
                ...(Array.isArray(data.baseline_video_urls) ? data.baseline_video_urls : []),
                ...uploadedUrls
            ];

            // 3) 提交问卷（包含基线视频URL）
            await studentService.submitOnboarding({
                coachId: coachId,
                answers: data,
                baseline_video_urls: allUrls
            });
        } catch (e) {
            console.warn('提交问卷/基线视频失败（忽略继续）:', e);
        }

        // 显示生成方式选择界面
        setCurrentStep('choose_generation');
    };

    const generatePlan = async (assessmentData: any) => {
        setIsGenerating(true);
        setMessage({ type: 'info', text: '正在生成个性化训练计划...' });

        try {
            // 构建增强输入
            const coachTarget = (window as any).__coach_create_plan_target__;
            const input: EnhancedPlanInput = {
                userId: coachTarget?.studentId || (localStorage.getItem('current_user_id') || ''),
                coachId: coachId,
                goal: 'strength', // 根据domain确定
                level: assessmentData.level || 'intermediate',
                focus: 'upper', // 根据domain确定
                duration_weeks: 6,
                frequency_per_week: assessmentData.weekly_frequency || 3,
                time_per_session: assessmentData.session_duration || 60,
                domain: selectedDomain,
                assessment_data: assessmentData,
                weekly_frequency: assessmentData.weekly_frequency || 3,
                session_duration: assessmentData.session_duration || 60,
                available_days: assessmentData.available_days || [],
                equipment: assessmentData.equipment || [],
                intensity_preference: assessmentData.intensity_preference || 'balanced',
                rest_policy: assessmentData.rest_policy || 'medium',
                injuries: assessmentData.injuries,
                specific_goals: assessmentData.specific_goal
            };

            // 1. 使用规则引擎生成基础计划
            const rulePlan = await generatePlanByCoachRules(input);
            setRuleEnginePlan(rulePlan);

            // 2. 如果需要AI增强
            let finalPlan = rulePlan;
            if (useAIEnhancement) {
                setMessage({ type: 'info', text: 'AI正在为您个性化增强计划...' });

                const aiService = AIEnhancementService.getInstance();
                const enhancements = await aiService.enhancePlan({
                    plan: rulePlan,
                    assessmentData: assessmentData,
                    domain: selectedDomain,
                    specificGoal: assessmentData.specific_goal,
                    injuries: assessmentData.injuries
                });

                finalPlan = aiService.applyEnhancements(rulePlan, enhancements);
                setEnhancedPlan(finalPlan);
            }

            setMessage({ type: 'success', text: '训练计划生成成功！' });
            setCurrentStep('generated');

            // 3. 保存到数据库
            const newPlanId = await savePlanToDatabase(finalPlan, input);

            if (onPlanGenerated) {
                onPlanGenerated({ id: newPlanId, plan: finalPlan });
            }

        } catch (error) {
            console.error('生成计划失败:', error);
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : '生成训练计划失败，请稍后重试'
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const savePlanToDatabase = async (plan: any, input: EnhancedPlanInput) => {
        try {
            // 保存训练计划基本信息
            const { data: planData, error: planError } = await supabase
                .from('training_plans')
                .insert({
                    user_id: input.userId,
                    coach_id: input.coachId,
                    title: plan.meta.title,
                    description: `${plan.meta.duration_weeks}周周期化训练计划`,
                    difficulty_level: input.level,
                    duration_weeks: plan.meta.duration_weeks,
                    ai_generated: true,
                    enhanced_by_ai: useAIEnhancement,
                    domain: input.domain,
                    assessment_data: input.assessment_data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (planError) throw planError;

            // 保存详细的训练计划（统一走函数）
            const planDetails = [] as any[];
            plan.weeks.forEach((week: any) => {
                week.sessions.forEach((session: any, idx: number) => {
                    planDetails.push({
                        week_number: week.week,
                        day_of_week: session.day,
                        session_focus: session.focus,
                        main_exercises: session.main,
                        accessory_exercises: session.accessories,
                        warmup: plan.meta.global_warmup,
                        cooldown: plan.meta.cooldown,
                        notes: session.notes || plan.meta.safety_notes?.join('\n'),
                        order_index: idx
                    });
                });
            });

            await studentService.upsertTrainingPlanDetails(planData.id, planDetails);

            // 返回planId供外层跳转到训练Hub
            return planData.id as string;
        } catch (error) {
            console.error('保存计划失败:', error);
            throw error;
        }
    };

    const handleFastGeneration = async () => {
        setCurrentStep('preview');
    };

    const handleWaitForCoach = () => {
        setMessage({
            type: 'info',
            text: '您的信息已提交给教练，教练将为您制定个性化计划。请耐心等待教练制定计划。'
        });
        setCurrentStep('generated');
    };

    const handleBack = () => {
        switch (currentStep) {
            case 'assessment':
                setCurrentStep('domain');
                break;
            case 'choose_generation':
                setCurrentStep('assessment');
                break;
            case 'preview':
                setCurrentStep('choose_generation');
                break;
            case 'generated':
                if (onBack) onBack();
                break;
            default:
                if (onBack) onBack();
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 'domain':
                return (
                    <ActionDomainSelector
                        coachId={coachId}
                        onSelect={handleDomainSelect}
                        selectedDomain={selectedDomain}
                    />
                );

            case 'assessment':
                return (
                    <AssessmentForm
                        coachId={coachId}
                        domain={selectedDomain}
                        onSubmit={handleAssessmentSubmit}
                        onBack={handleBack}
                        userId={(window as any).__coach_create_plan_target__?.studentId || (localStorage.getItem('current_user_id') || '')}
                    />
                );

            case 'choose_generation':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">选择计划生成方式</h2>
                            <p className="text-gray-600">您的信息已成功提交，请选择获取训练计划的方式</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 快速生成 */}
                            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 hover:border-blue-500 transition-colors">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Zap className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">AI快速生成</h3>
                                    <p className="text-gray-600 mb-4">基于您的信息，AI立即为您生成个性化训练计划</p>
                                    <ul className="text-sm text-gray-500 mb-6 text-left">
                                        <li>• 即时获得计划</li>
                                        <li>• 基于科学算法</li>
                                        <li>• 适合标准需求</li>
                                        <li>• 可随时调整</li>
                                    </ul>
                                    <button
                                        onClick={handleFastGeneration}
                                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        立即生成计划
                                    </button>
                                </div>
                            </div>

                            {/* 等待教练 */}
                            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 hover:border-green-500 transition-colors">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Brain className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">教练定制</h3>
                                    <p className="text-gray-600 mb-4">专业教练根据您的情况量身定制训练计划</p>
                                    <ul className="text-sm text-gray-500 mb-6 text-left">
                                        <li>• 专业教练审核</li>
                                        <li>• 个性化调整</li>
                                        <li>• 考虑特殊需求</li>
                                        <li>• 更加精准</li>
                                    </ul>
                                    <button
                                        onClick={handleWaitForCoach}
                                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        等待教练制定
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="text-center">
                            <button
                                onClick={handleBack}
                                className="text-gray-600 hover:text-gray-900 flex items-center space-x-1 mx-auto"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>返回修改信息</span>
                            </button>
                        </div>
                    </div>
                );

            case 'preview':
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-900">计划预览</h2>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={useAIEnhancement}
                                        onChange={(e) => setUseAIEnhancement(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">使用AI增强</span>
                                </label>
                            </div>

                            <div className="text-sm text-gray-600 mb-4">
                                <p>• 基于规则引擎生成，确保计划科学性和可执行性</p>
                                {useAIEnhancement && <p>• AI将提供个性化文案、技术要点和安全提示</p>}
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={() => generatePlan(assessmentData)}
                                    disabled={isGenerating}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                                            生成计划中...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-4 h-4 inline mr-2" />
                                            生成我的训练计划
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'generated':
                return (
                    <TrainingPlanPreview
                        plan={enhancedPlan || ruleEnginePlan}
                        onBack={handleBack}
                        showSaveButton={true}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                <Brain className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">AI智能训练计划</h1>
                                <p className="text-gray-600">基于规则引擎 + AI增强的个性化方案</p>
                            </div>
                        </div>

                        <button
                            onClick={handleBack}
                            className="flex items-center text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5 mr-1" />
                            返回
                        </button>
                    </div>

                    {/* 消息提示 */}
                    {message && (
                        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' :
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

                    {renderStep()}
                </div>
            </div>
        </div>
    );
};

export default EnhancedAITrainingGenerator;