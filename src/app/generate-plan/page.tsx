'use client'

import React, { useState } from 'react';
import { Target, ArrowUp, ArrowDown, Zap, Activity } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import AssessmentForm from './AssessmentForm';
import { useSession } from 'next-auth/react';

interface ActionDomain {
    key: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface ActionDomainSelectorProps {
    onSelect: (domain: string) => void;
    selectedDomain?: string;
}

const ActionDomainSelector: React.FC<ActionDomainSelectorProps> = ({
    onSelect,
    selectedDomain
}) => {

    const searchParams = useSearchParams();
    const router = useRouter();
    const coachId = searchParams.get('coachId');

    if (!coachId) {
        router.push('/coach');
    }

    const domains: ActionDomain[] = [
        {
            key: 'weighted_pullup',
            name: '负重引体',
            description: '专注于引体向上的力量发展，适合想要提升背部和手臂力量的学员',
            icon: <ArrowUp className="w-8 h-8" />,
            features: [
                '自重引体最大次数评估',
                '1RM负重估算',
                '肩胛启动技术检查',
                '6周周期化递进'
            ],
            difficulty: 'intermediate'
        },
        {
            key: 'weighted_dips',
            name: '负重臂屈伸',
            description: '专注于臂屈伸的力量发展，针对胸部和三头肌的专项训练',
            icon: <ArrowDown className="w-8 h-8" />,
            features: [
                '自重臂屈伸最大次数评估',
                '1RM负重估算',
                '肩部活动度检查',
                '6周周期化递进'
            ],
            difficulty: 'intermediate'
        },
        {
            key: 'combo',
            name: '引体+臂屈伸组合',
            description: '平衡发展上肢拉力与推力，全面提升上肢力量',
            icon: <Activity className="w-8 h-8" />,
            features: [
                '双重动作能力评估',
                '推拉力量平衡分析',
                '4-5周高频训练',
                '综合力量提升'
            ],
            difficulty: 'advanced'
        }
    ];

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'beginner':
                return 'bg-green-100 text-green-800';
            case 'intermediate':
                return 'bg-blue-100 text-blue-800';
            case 'advanced':
                return 'bg-primary-100 text-primary-800';
            default:
                return 'bg-surface-100 text-surface-800';
        }
    };

    const getDifficultyText = (difficulty: string) => {
        switch (difficulty) {
            case 'beginner':
                return '初级';
            case 'intermediate':
                return '中级';
            case 'advanced':
                return '高级';
            default:
                return '未知';
        }
    };

    return (
        <div className='min-h-screen flex flex-col items-center pt-10'>
            <div className="max-w-4xl bg-surface-50 rounded-xl shadow-sm p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-surface-900 mb-2">选择您的训练域</h2>
                    <p className="text-surface-600">
                        根据您想要重点发展的动作选择相应的训练域
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {domains.map((domain) => (
                        <div
                            key={domain.key}
                            onClick={() => onSelect(domain.key)}
                            className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${selectedDomain === domain.key
                                ? 'border-primary-500 bg-primary-100 dark:bg-primary-900 shadow-lg scale-105'
                                : 'border-surface-200 hover:border-surface-300 hover:shadow-md'
                                }`}
                        >
                            <div className="text-center mb-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${selectedDomain === domain.key
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-surface-200 text-surface-600'
                                    }`}>
                                    {domain.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-surface-900 mb-2">{domain.name}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(domain.difficulty)}`}>
                                    {getDifficultyText(domain.difficulty)}
                                </span>
                            </div>

                            <p className="text-sm text-surface-600 mb-4 text-center">{domain.description}</p>

                            <div className="space-y-2">
                                {domain.features.map((feature, index) => (
                                    <div key={index} className="flex items-center text-sm text-surface-600">
                                        <Zap className="w-3 h-3 mr-2 text-yellow-500" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-sm text-surface-500">
                        💡 选择后我们将根据该动作域的特点为您定制专属评估表单
                    </p>
                </div>
            </div>
        </div>
    );
};

const GeneratePlanPage: React.FC = () => {
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();
    
    const coachId = searchParams.get('coachId');
    const userId = session?.user?.id;

    const handleSelectDomain = (domain: string) => {
        setSelectedDomain(domain);
        setShowForm(true);
    };

    const handleBackToSelection = () => {
        setShowForm(false);
        setSelectedDomain(null);
    };

    const handleSubmit = (data: any) => {
        console.log('提交表单数据:', data);
        // 这里应该调用API提交表单数据并生成训练计划
        // 实现完成后跳转到计划详情页
        router.push('/dashboard');
    };

    if (!coachId) {
        router.push('/coach');
        return null;
    }

    if (!userId) {
        // 用户未登录，应该重定向到登录页
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-surface-100 py-8">
            <div className="container mx-auto px-4">
                {showForm && selectedDomain ? (
                    <AssessmentForm
                        coachId={coachId}
                        domain={selectedDomain}
                        userId={userId}
                        onSubmit={handleSubmit}
                        onBack={handleBackToSelection}
                    />
                ) : (
                    <ActionDomainSelector
                        onSelect={handleSelectDomain}
                        selectedDomain={selectedDomain || undefined}
                    />
                )}
            </div>
        </div>
    );
};

export default GeneratePlanPage;