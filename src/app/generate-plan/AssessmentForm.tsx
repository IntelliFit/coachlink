import React, { useState, useEffect } from 'react';
import { studentService } from '../service/studentService';
import TrainingVideoUploader from '@/components/video/TrainingVideoUploader';

import {
    User,
    Target,
    Clock,
    Calendar,
    Activity,
    AlertTriangle,
    CheckCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    min?: number;
    max?: number;
    options?: any[];
    placeholder?: string;
}

interface AssessmentFormProps {
    coachId: string;
    domain: string;
    onSubmit: (data: any) => void;
    onBack: () => void;
    userId: string;
}

const AssessmentForm: React.FC<AssessmentFormProps> = ({
    coachId,
    domain,
    onSubmit,
    onBack,
    userId
}) => {
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [baselineVideoIds, setBaselineVideoIds] = useState<string[]>([]);
    const [videoUploadStatus, setVideoUploadStatus] = useState<string>('');

    useEffect(() => {
        loadFormSchema();
    }, [domain, coachId]);

    const loadFormSchema = async () => {
        try {
            setLoading(true);

            // 通过学生服务获取表单配置
            const res = await studentService.getFormSchema({ coachId, domain });
            
            if (res?.formSchema?.fields) {
                setFormFields(res.formSchema.fields);
            } else {
                setFormFields(getDefaultFields(domain));
            }
        } catch (error: any) {
            console.error('加载表单配置错误:', error);
            setFormFields(getDefaultFields(domain));
        } finally {
            setLoading(false);
        }
    };

    const getDefaultFields = (domain: string): FormField[] => {
        const baseFields = [
            {
                name: 'weekly_frequency',
                type: 'select',
                label: '每周训练频率',
                required: true,
                options: [3, 4]
            },
            {
                name: 'session_duration',
                type: 'select',
                label: '每次训练时长（分钟）',
                required: true,
                options: [45, 60, 90]
            },
            {
                name: 'available_days',
                type: 'multiselect',
                label: '可训练日',
                required: true,
                options: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
            },
            {
                name: 'equipment',
                type: 'multiselect',
                label: '可用器械',
                required: true,
                options: ['单杠', '双杠', '弹力带', '杠铃片', '哑铃']
            },
            {
                name: 'intensity_preference',
                type: 'select',
                label: '强度偏好',
                required: true,
                options: ['强度优先', '容量优先', '平衡发展']
            },
            {
                name: 'injuries',
                type: 'textarea',
                label: '伤病与限制',
                required: false,
                placeholder: '请描述任何相关的伤病历史...'
            },
            {
                name: 'specific_goal',
                type: 'textarea',
                label: '具体目标',
                required: true,
                placeholder: '请详细描述您的训练目标...'
            }
        ];

        switch (domain) {
            case 'weighted_pullup':
                return [
                    {
                        name: 'bw_max_reps',
                        type: 'number',
                        label: '自重引体最大连续次数',
                        required: true,
                        min: 0,
                        max: 200
                    },
                    {
                        name: 'est_1rm',
                        type: 'number',
                        label: '估算1RM负重（kg）',
                        required: false,
                        min: 0,
                        max: 100
                    },
                    {
                        name: 'est_3rm',
                        type: 'number',
                        label: '估算3RM负重（kg）',
                        required: false,
                        min: 0,
                        max: 100
                    },
                    {
                        name: 'can_scapular_initiate',
                        type: 'boolean',
                        label: '是否会肩胛启动',
                        required: true
                    },
                    {
                        name: 'can_pause_top',
                        type: 'boolean',
                        label: '能否在顶部暂停2秒',
                        required: true
                    },
                    {
                        name: 'can_pause_bottom',
                        type: 'boolean',
                        label: '能否在底部暂停2秒',
                        required: true
                    },
                    {
                        name: 'grip_preference',
                        type: 'select',
                        label: '握距偏好',
                        required: true,
                        options: ['宽握', '中握', '窄握', '无偏好']
                    },
                    ...baseFields
                ];

            case 'weighted_dips':
                return [
                    {
                        name: 'bw_max_reps',
                        type: 'number',
                        label: '自重臂屈伸最大连续次数',
                        required: true,
                        min: 0,
                        max: 200
                    },
                    {
                        name: 'est_1rm',
                        type: 'number',
                        label: '估算1RM负重（kg）',
                        required: false,
                        min: 0,
                        max: 100
                    },
                    {
                        name: 'elbow_issues',
                        type: 'boolean',
                        label: '是否有肘部伤病史',
                        required: true
                    },
                    {
                        name: 'shoulder_mobility',
                        type: 'select',
                        label: '肩部活动度',
                        required: true,
                        options: ['良好', '一般', '受限']
                    },
                    ...baseFields
                ];

            case 'combo':
                return [
                    {
                        name: 'pullup_bw_max',
                        type: 'number',
                        label: '自重引体最大连续次数',
                        required: true,
                        min: 0,
                        max: 200
                    },
                    {
                        name: 'dips_bw_max',
                        type: 'number',
                        label: '自重臂屈伸最大连续次数',
                        required: true,
                        min: 0,
                        max: 200
                    },
                    {
                        name: 'pullup_1rm',
                        type: 'number',
                        label: '引体估算1RM负重（kg）',
                        required: false,
                        min: 0,
                        max: 100
                    },
                    {
                        name: 'dips_1rm',
                        type: 'number',
                        label: '臂屈伸估算1RM负重（kg）',
                        required: false,
                        min: 0,
                        max: 100
                    },
                    {
                        name: 'priority',
                        type: 'select',
                        label: '优先发展',
                        required: true,
                        options: ['引体向上', '臂屈伸', '平衡发展']
                    },
                    ...baseFields
                ];

            default:
                return baseFields;
        }
    };

    const categorizeFields = () => {
        const categories = {
            capability: formFields.filter(f =>
                ['bw_max_reps', 'est_1rm', 'est_3rm', 'pullup_bw_max', 'dips_bw_max', 'pullup_1rm', 'dips_1rm'].includes(f.name) ||
                f.name.includes('can_') || f.name.includes('_mobility') || f.name.includes('_issues')
            ),
            technical: formFields.filter(f =>
                f.name.includes('grip_') || f.name.includes('priority')
            ),
            schedule: formFields.filter(f =>
                ['weekly_frequency', 'session_duration', 'available_days'].includes(f.name)
            ),
            equipment: formFields.filter(f => f.name === 'equipment'),
            preference: formFields.filter(f =>
                ['intensity_preference', 'rest_policy', 'injuries', 'specific_goal'].includes(f.name)
            )
        };

        return Object.entries(categories).filter(([, fields]) => fields.length > 0);
    };

    const validateStep = (category: string, fields: FormField[]) => {
        const stepErrors: Record<string, string> = {};

        fields.forEach(field => {
            const value = formData[field.name];

            // 特殊处理multiselect字段
            if (field.required) {
                if (field.type === 'multiselect') {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        stepErrors[field.name] = `${field.label} 不能为空`;
                    }
                } else if (!value) {
                    stepErrors[field.name] = `${field.label} 不能为空`;
                }
            }

            if (field.type === 'number' && value !== undefined && value !== '') {
                const numValue = Number(value);
                if (field.min !== undefined && numValue < field.min) {
                    stepErrors[field.name] = `${field.label} 不能小于 ${field.min}`;
                }
                if (field.max !== undefined && numValue > field.max) {
                    stepErrors[field.name] = `${field.label} 不能大于 ${field.max}`;
                }
            }
        });

        setErrors(prev => ({ ...prev, ...stepErrors }));
        console.log('验证步骤:', category, '错误:', stepErrors, '表单数据:', formData);
        return Object.keys(stepErrors).length === 0;
    };

    const handleNext = () => {
        const categories = categorizeFields();
        const currentCategory = categories[currentStep];

        if (currentCategory && validateStep(currentCategory[0], currentCategory[1])) {
            if (currentStep < categories.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                handleSubmit();
            }
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = () => {
        const allValid = categorizeFields().every(([cat, fields]) => validateStep(cat, fields));

        if (allValid) {
            onSubmit({
                domain,
                coach_id: coachId,
                ...formData,
                baseline_video_ids: baselineVideoIds
            });
        }
    };

    const renderField = (field: FormField) => {
        const value = formData[field.name];
        const error = errors[field.name];

        const baseClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-500' : 'border-gray-300'
            }`;

        switch (field.type) {
            case 'number':
                return (
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            value={value || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, [field.name]: e.target.value });
                                setErrors({ ...errors, [field.name]: '' });
                            }}
                            className={baseClass}
                            placeholder={field.placeholder}
                        />
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'select':
                return (
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            value={value || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, [field.name]: e.target.value });
                                setErrors({ ...errors, [field.name]: '' });
                            }}
                            className={baseClass}
                        >
                            <option value="">请选择...</option>
                            {field.options?.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'multiselect':
                return (
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {field.options?.map(option => (
                                <label key={option} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={Array.isArray(value) && value.includes(option)}
                                        onChange={(e) => {
                                            const current = Array.isArray(value) ? value : [];
                                            const updated = e.target.checked
                                                ? [...current, option]
                                                : current.filter(item => item !== option);
                                            setFormData({ ...formData, [field.name]: updated });
                                            setErrors({ ...errors, [field.name]: '' });
                                        }}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">{option}</span>
                                </label>
                            ))}
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'boolean':
                return (
                    <label className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => {
                                setFormData({ ...formData, [field.name]: e.target.checked });
                                setErrors({ ...errors, [field.name]: '' });
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700">{field.label}</span>
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                    </label>
                );

            case 'textarea':
                return (
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <textarea
                            value={value || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, [field.name]: e.target.value });
                                setErrors({ ...errors, [field.name]: '' });
                            }}
                            className={baseClass}
                            rows={3}
                            placeholder={field.placeholder}
                        />
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                );

            default:
                return null;
        }
    };

    const categories = categorizeFields();
    const currentCategory = categories[currentStep];
    const totalSteps = categories.length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!currentCategory) {
        return <div>加载配置失败</div>;
    }

    const [categoryName, categoryFields] = currentCategory;
    const categoryTitles: Record<string, string> = {
        capability: '能力评估',
        technical: '技术要点',
        schedule: '训练安排',
        equipment: '器械配置',
        preference: '个性化偏好'
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        返回选择
                    </button>
                    <div className="text-sm text-gray-500">
                        步骤 {currentStep + 1} / {totalSteps}
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {categoryTitles[categoryName] || categoryName}
                </h2>
                <p className="text-gray-600 text-sm">
                    请根据您的实际情况填写以下信息
                </p>
            </div>

            <div className="space-y-6 mb-8">
                {categoryFields.map((field) => (
                    <div key={field.name}>{renderField(field)}</div>
                ))}
            </div>

            {/* 基线视频上传 - 只在最后一步显示 */}
            {currentStep === totalSteps - 1 && userId && (
                <div className="mb-8 p-6 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">基线能力视频（可选）</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        上传一些展示您当前运动能力的视频，帮助教练更好地了解您的初始状态，制定更适合的训练计划。
                    </p>

                    <TrainingVideoUploader
                        userId={userId}
                        context={{
                            type: 'baseline',
                            requires_review: true,
                            coach_id: coachId,
                            exercise_name: 'baseline_assessment'
                        }}
                        onUploadSuccess={(video) => {
                            setBaselineVideoIds(prev => [...prev, video.id]);
                            setVideoUploadStatus('基线视频上传成功！');
                        }}
                        onUploadError={(error) => {
                            setVideoUploadStatus(`上传失败: ${error.message}`);
                        }}
                        showUrlInput={true}
                    />
                </div>
            )}

            <div className="flex justify-between">
                <button
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-4 h-4 inline mr-1" />
                    上一步
                </button>

                <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    {currentStep === totalSteps - 1 ? (
                        <>
                            生成计划
                            <CheckCircle className="w-4 h-4 inline ml-1" />
                        </>
                    ) : (
                        <>
                            下一步
                            <ChevronRight className="w-4 h-4 inline ml-1" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AssessmentForm;