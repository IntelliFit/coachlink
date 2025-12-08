'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { User, FileText, Calendar, Users, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';
import { UserProfilesRow } from '@/types';

interface SubscribeAnswer {
    question: string;
    answer: string;
}

interface StudentData {
    id: string;
    student_id: string;
    tier: string;
    status: string;
    start_date: string;
    end_date: string;
    profile: UserProfilesRow | null;
    subscribe_data: {
        answers: SubscribeAnswer[];
    } | null;
}

interface StudentProfilePanelProps {
    /** 订阅ID (params.id) */
    subscriptionId: string;
    /** 学员姓名 (已加载的) */
    studentName: string;
}

/**
 * 学员档案面板组件（内嵌式）
 * 用于在计划编辑页面显示学员的档案信息
 */
export const StudentProfilePanel: React.FC<StudentProfilePanelProps> = ({
    subscriptionId,
    studentName
}) => {
    const [loading, setLoading] = useState(false);
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [expanded, setExpanded] = useState(true);

    // 加载学员数据
    useEffect(() => {
        if (subscriptionId) {
            loadStudentData();
        }
    }, [subscriptionId]);

    const loadStudentData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coach/get-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pagination: { page: 0, limit: 100 } })
            });
            const result = await res.json();
            
            if (result.success && result.data?.students) {
                const student = result.data.students.find((s: any) => s.id === subscriptionId);
                if (student) {
                    setStudentData(student);
                }
            }
        } catch (error) {
            console.error('加载学员数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // 计算订阅时长（周）
    const calculateDuration = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        const diffMonths = Math.ceil(diffWeeks / 4);
        return { weeks: diffWeeks, months: diffMonths };
    };

    const profile = studentData?.profile;
    const duration = studentData ? calculateDuration(studentData.start_date, studentData.end_date) : null;

    return (
        <div className="bg-surface border border-surface-200 rounded-lg mb-6">
            <div 
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <User className="text-primary-500" size={20} />
                    <span className="font-bold text-lg text-900">学员信息</span>
                </div>
                <Button 
                    icon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                    className="p-button-text p-button-rounded"
                    severity="secondary"
                />
            </div>

            {expanded && (
                <div className="p-4 border-t border-surface-200">
                    {loading ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-lg">
                                <Skeleton shape="circle" size="3rem" />
                                <div className="flex-1">
                                    <Skeleton width="60%" height="1.25rem" className="mb-2" />
                                    <Skeleton width="40%" height="0.875rem" />
                                </div>
                            </div>
                            <Skeleton height="6rem" className="rounded-lg" />
                            <Skeleton height="10rem" className="rounded-lg" />
                        </div>
                    ) : studentData ? (
                        <div className="space-y-4">
                            {/* 学员头部信息 */}
                            <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200">
                                <Avatar
                                    image={profile?.avatar_url}
                                    label={profile?.nickname?.charAt(0) || studentName?.charAt(0) || 'U'}
                                    size="large"
                                    shape="circle"
                                    className="bg-primary-500 text-white font-bold"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-900 truncate">
                                        {profile?.nickname || studentName || '学员'}
                                    </h3>
                                    <div className="flex items-center gap-1 text-xs text-600 mt-0.5">
                                        <Users size={12} />
                                        <span>学员</span>
                                    </div>
                                </div>
                            </div>

                            {/* 订阅信息 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                                    <div className="flex items-center gap-1.5 text-600 text-xs mb-1">
                                        <Calendar size={11} />
                                        订阅开始
                                    </div>
                                    <div className="text-sm font-semibold text-900">
                                        {formatDate(studentData.start_date)}
                                    </div>
                                </div>
                                <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                                    <div className="flex items-center gap-1.5 text-600 text-xs mb-1">
                                        <Clock size={11} />
                                        订阅时长
                                    </div>
                                    <div className="text-sm font-semibold text-900">
                                        {duration?.months}个月 ({duration?.weeks}周)
                                    </div>
                                </div>
                            </div>

                            {/* 本期需求（订阅问卷） */}
                            {studentData.subscribe_data?.answers && studentData.subscribe_data.answers.length > 0 && (
                                <div className="bg-primary-50 rounded-lg border border-primary-200 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="text-primary-700" size={16} />
                                        <h4 className="font-bold text-primary-900 text-sm">本期需求</h4>
                                    </div>
                                    <div className="space-y-2">
                                        {studentData.subscribe_data.answers.map((item, index) => (
                                            <div key={`q-${index}`} className="bg-white rounded-lg p-3 border border-primary-100">
                                                <div className="text-xs font-medium text-primary-700 mb-1">
                                                    Q{index + 1}: {item.question}
                                                </div>
                                                <div className="text-sm text-900 bg-primary-25 p-2 rounded">
                                                    {item.answer}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 公共档案 */}
                            <div className="border-t border-surface-200 pt-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <User className="text-primary-500" size={16} />
                                    <h4 className="font-bold text-900 text-sm">公共档案</h4>
                                </div>
                                
                                {/* 基础信息 */}
                                <PersonalInfoDisplay 
                                    profile={profile || null} 
                                    phone={profile?.phone} 
                                />

                                {/* 运动数据卡片 */}
                                <SportCardsDisplay sportCards={profile?.sport_cards as any} />

                                {/* 进步足迹 */}
                                {studentData.student_id && (
                                    <CoachViewProgressTimeline 
                                        studentId={studentData.student_id} 
                                        limit={5} 
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                            <User className="w-10 h-10 text-surface-300 mb-2" />
                            <p className="text-sm text-surface-500">无法加载学员信息</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};