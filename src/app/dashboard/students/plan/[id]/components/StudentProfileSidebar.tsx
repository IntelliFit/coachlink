'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { User, FileText, Calendar, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
    /** 面板是否展开 */
    expanded: boolean;
    /** 切换展开/收起 */
    onToggle: () => void;
}

/**
 * 学员档案面板组件（内嵌式）
 * 用于在计划编辑页面右侧显示学员的完整档案信息
 * 展开时不遮挡编辑区，共享页面空间
 */
export const StudentProfilePanel: React.FC<StudentProfilePanelProps> = ({
    subscriptionId,
    studentName,
    expanded,
    onToggle
}) => {
    const [loading, setLoading] = useState(false);
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    // 加载学员数据
    useEffect(() => {
        if (expanded && !dataLoaded && subscriptionId) {
            loadStudentData();
        }
    }, [expanded, subscriptionId, dataLoaded]);

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
                    setDataLoaded(true);
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

    // 收起状态：只显示切换按钮
    if (!expanded) {
        return (
            <div className="flex-shrink-0">
                <Button
                    icon={<ChevronLeft size={16} />}
                    label="学员档案"
                    onClick={onToggle}
                    className="h-full"
                    severity="info"
                    outlined
                    size="small"
                />
            </div>
        );
    }

    // 展开状态：显示完整面板
    return (
        <div className="w-[380px] flex-shrink-0 bg-surface border-l border-surface-200 flex flex-col h-full">
            {/* 面板头部 */}
            <div className="flex items-center justify-between p-4 border-b border-surface-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-2">
                    <User className="text-primary" size={20} />
                    <span className="font-bold text-lg text-surface-900">学员档案</span>
                </div>
                <Button
                    icon={<ChevronRight size={16} />}
                    onClick={onToggle}
                    className="p-button-text p-button-rounded"
                    severity="secondary"
                    size="small"
                    tooltip="收起面板"
                    tooltipOptions={{ position: 'left' }}
                />
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-xl">
                            <Skeleton shape="circle" size="3rem" />
                            <div className="flex-1">
                                <Skeleton width="60%" height="1.25rem" className="mb-2" />
                                <Skeleton width="40%" height="0.875rem" />
                            </div>
                        </div>
                        <Skeleton height="6rem" />
                        <Skeleton height="10rem" />
                    </div>
                ) : studentData ? (
                    <div className="space-y-4">
                        {/* 学员头部信息 */}
                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-surface-200 shadow-sm">
                            <Avatar
                                image={profile?.avatar_url}
                                label={profile?.nickname?.charAt(0) || studentName?.charAt(0) || 'U'}
                                size="large"
                                shape="circle"
                                className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-surface-900 truncate">
                                    {profile?.nickname || studentName || '学员'}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-surface-600 mt-0.5">
                                    <Users size={12} />
                                    <span>学员</span>
                                </div>
                            </div>
                        </div>

                        {/* 订阅信息 */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 bg-surface-50 rounded-lg border border-surface-100">
                                <div className="flex items-center gap-1.5 text-surface-500 text-xs mb-0.5">
                                    <Calendar size={11} />
                                    订阅开始
                                </div>
                                <div className="text-sm font-semibold text-surface-900">
                                    {formatDate(studentData.start_date)}
                                </div>
                            </div>
                            <div className="p-2.5 bg-surface-50 rounded-lg border border-surface-100">
                                <div className="flex items-center gap-1.5 text-surface-500 text-xs mb-0.5">
                                    <Clock size={11} />
                                    订阅时长
                                </div>
                                <div className="text-sm font-semibold text-surface-900">
                                    {duration?.months}个月 ({duration?.weeks}周)
                                </div>
                            </div>
                        </div>

                        {/* 本期需求（订阅问卷） */}
                        {studentData.subscribe_data?.answers && studentData.subscribe_data.answers.length > 0 && (
                            <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="text-amber-600" size={16} />
                                    <h4 className="font-bold text-amber-900 text-sm">本期需求</h4>
                                </div>
                                <div className="space-y-2">
                                    {studentData.subscribe_data.answers.map((item, index) => (
                                        <div key={`q-${index}`} className="bg-white rounded-lg p-2.5 border border-amber-100">
                                            <div className="text-xs font-medium text-amber-700 mb-1">
                                                Q{index + 1}: {item.question}
                                            </div>
                                            <div className="text-sm text-surface-900 bg-amber-50 p-1.5 rounded">
                                                {item.answer}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 公共档案 */}
                        <div className="border-t border-surface-200 pt-3">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="text-primary" size={16} />
                                <h4 className="font-bold text-surface-900 text-sm">公共档案</h4>
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
        </div>
    );
};

export default StudentProfilePanel;
