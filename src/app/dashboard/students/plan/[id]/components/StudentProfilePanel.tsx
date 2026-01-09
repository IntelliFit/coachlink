'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { User, FileText, Calendar, Users, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';
import { CoachSubscriptionRow, UserProfilesRow } from '@/types';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { RadioButton } from 'primereact/radiobutton';
import { actionLibService } from '@/app/service/actionLibService';
import { CoachActionRow } from '@/types';
import { useSession } from 'next-auth/react';

interface StudentProfilePanelProps {
    studentData: GetStudentResponseDto['student'] | null;
    subscription: CoachSubscriptionRow | null;
    loading: boolean;
    onEditQuestionnaire?: () => void; // 点击编辑问卷时的回调
}

export const StudentProfilePanel: React.FC<StudentProfilePanelProps> = ({
    studentData,
    loading,
    onEditQuestionnaire
}) => {
    const [expanded, setExpanded] = useState(false);
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);
    const { data: session } = useSession();

    useEffect(() => {

        if (!session?.user?.id) return;
        const fetchAutoComputeActions = async () => {
            setLoadingActions(true);
            try {
                const res = await actionLibService.listAutoComputeActions({
                    coachId: session.user.id
                });
                if (res && res.actions) {
                    setAutoComputeActions(res.actions);
                }
            } catch (error) {
                console.error("获取自动计算动作失败:", error);
            } finally {
                setLoadingActions(false);
            }
        };

        fetchAutoComputeActions();
    }, [session?.user?.id]);

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
        const end = endDate ? new Date(endDate) : new Date();
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.ceil(diffDays / 7);
        const diffMonths = Math.ceil(diffDays / 30); // 按每月30天计算
        return { days: diffDays, weeks: diffWeeks, months: diffMonths };
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
                    {/* 学员头部信息 */}
                    <Avatar
                        image={profile?.avatar_url}
                        label={profile?.nickname?.charAt(0) || studentData?.profile?.nickname.charAt(0) || 'U'}
                        size="large"
                        shape="circle"
                        className="bg-primary-500 text-white font-bold"
                    />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-900 truncate">
                            {profile?.nickname || studentData?.profile?.nickname || '学员'}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-600 mt-0.5">
                            <Users size={12} />
                            <span>学员</span>
                        </div>
                    </div>
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
                                        {duration?.days}天
                                    </div>
                                </div>
                            </div>

                            {/* 本期需求（订阅问卷） */}
                            {studentData?.subscribe_data && studentData.subscribe_data.length > 0 && (
                                <div className="bg-surface-50 rounded-lg border border-surface-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} />
                                            <h4 className="font-bold text-sm">本期需求</h4>
                                        </div>
                                        {onEditQuestionnaire && (
                                            <Button
                                                label="编辑"
                                                size="small"
                                                icon="pi pi-pencil"
                                                text
                                                severity="secondary"
                                                onClick={onEditQuestionnaire}
                                                className="text-xs"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        {studentData.subscribe_data.map((item, index) => (
                                            <div key={`q-${index}`} className="bg-surface-0 rounded-lg p-4 border border-surface-100 shadow-sm">
                                                {item.type === 'tags' ? (
                                                    <>
                                                        <div className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                                            Q{index + 1}. 请选择您偏好的训练项目（可多选）
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {item.userSelections?.map((tag, tagIndex) => (
                                                                <span
                                                                    key={tagIndex}
                                                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : item.type === 'times' ? (
                                                    <>
                                                        <div className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                                            Q{index + 1}. 您希望每周训练几次？
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                                                <div key={num} className="flex items-center rounded px-3 py-2">
                                                                    <RadioButton
                                                                        disabled
                                                                        inputId={`times${index}-${num}`}
                                                                        name={`times${index}`}
                                                                        value={num}
                                                                        checked={item.userSelection === num}
                                                                    />
                                                                    <label htmlFor={`times${index}-${num}`} className="ml-2 text-sm">{num}次</label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : item.type === 'rm' ? (
                                                    <>
                                                        <div className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                                            Q{index + 1}. 请输入以下动作您的 RM
                                                        </div>
                                                        {loadingActions ? (
                                                            <div className="flex flex-col gap-3">
                                                                {[1, 2, 3].map((_, i) => (
                                                                    <div key={i} className="flex flex-column gap-2">
                                                                        <Skeleton width="100px" height="0.75rem" />
                                                                        <Skeleton width="150px" height="2rem" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-4">
                                                                {autoComputeActions.map((action) => {
                                                                    const rmValue = item.userInputs?.[action.id];
                                                                    return (
                                                                        <div key={action.id} className="flex flex-col">
                                                                            <label className="block text-xs text-600 mb-1">{action.name}</label>
                                                                            <div className="p-2 bg-surface-50 border border-surface-200 rounded">
                                                                                {rmValue ? `${rmValue} kg` : '未填写'}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : item.type === 'option' ? (
                                                    <>
                                                        <div className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                                            Q{index + 1}. {item.question || `问题 ${index + 1}`}
                                                        </div>
                                                        <div className="flex flex-col gap-4">
                                                            {item.options?.map((option, optionIndex) => (
                                                                <div key={optionIndex} className="flex items-center">
                                                                    <RadioButton
                                                                        disabled
                                                                        inputId={`option${index}-${optionIndex}`}
                                                                        name={`option${index}`}
                                                                        value={optionIndex}
                                                                        checked={item.userSelection === optionIndex}
                                                                    />
                                                                    <label htmlFor={`option${index}-${optionIndex}`} className="ml-2 text-sm">{option}</label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                                            Q{index + 1}. {item.question}
                                                        </div>
                                                        <div className="text-900 bg-primary-25 p-3 rounded min-h-[60px]">
                                                            {(item as any).userSelection || '未填写'}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 公共档案 */}
                            <div className="pt-3">

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