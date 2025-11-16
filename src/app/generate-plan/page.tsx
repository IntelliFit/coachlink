'use client'

import React, { useEffect, useState } from 'react';
import { Target, ArrowUp, ArrowDown, Zap, Activity } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import AssessmentForm from './AssessmentForm';
import { useSession } from 'next-auth/react';
import ActionDomainSelector from './ActionDomainSelector';


const GeneratePlanPage: React.FC = () => {
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session, status } = useSession();

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

    console.log('userId', userId);

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