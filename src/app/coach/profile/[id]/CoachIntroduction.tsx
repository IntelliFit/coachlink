'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Avatar } from 'primereact/avatar';
import { Tag } from 'primereact/tag';
import { useSession } from 'next-auth/react';
import { CoachesRow } from '@/types';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';
import { Button } from 'primereact/button';
import EditCoachProfileDialog from './EditCoachProfileDialog';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import ChatDialog from '@/components/chat/ChatDialog';
import { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import QuestionnaireForm from './QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { subscriptionService } from '@/app/service/subscriptionService';

interface CoachIntroductionProps {
    coach: CoachesRow;
    userSubscription: QueryCoachSubscription | null;
    aggregatedInfo: GetAggregatedInfoResponseDto | null;
}

const CoachIntroduction: React.FC<CoachIntroductionProps> = ({ coach, userSubscription, aggregatedInfo }) => {
    const { data: session } = useSession();
    const isOwnProfile = session?.user?.id === coach.user_id;

    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [chatroom, setChatroom] = useState<ChatroomDetail>(null);
    
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    const { showToast } = useToastContext();

    const specialtiesToShow = (aggregatedInfo?.specialties?.length
        ? aggregatedInfo.specialties
        : (coach.specialties || []));

    const aboutProfile = (coach.profile || {}) as Record<string, any>;
    const caseStudyCount = Array.isArray(aboutProfile.caseStudies) ? aboutProfile.caseStudies.length : 0;

    const contactCoach = async () => {
        if (!session?.user?.id) {
            return;
        }

        if (session.user.id === coach.user_id) {
            return;
        }

        setLoading(true);

        try {
            const res = await chatService.getChatroom({ members: [session.user.id, coach.user_id] });

            if (res) {
                setChatroom(null);
                setTimeout(() => {
                    setChatroom(res.chatroom);
                    setChatDialogVisible(true);
                }, 0);
            } else {
                showToast({ severity: 'error', summary: '创建聊天室出错' });
            }
        } finally {
            setLoading(false);
        }
    }

    const openQuestionnaire = async () => {
        setQuestionnaireLoading(true);
        try {
            // 获取问卷问题
            const qRes = await coachService.getQuestionnaires({
                coachId: coach.id
            });

            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '该教练暂无问卷' });
            }
        } catch (error) {
            console.error('获取问卷失败:', error);
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    const handleQuestionnaireSubmit = async (answers: TrainingItem[]) => {
        const res = await subscriptionService.updateSubscription({
            id: userSubscription.id,
            subscribe_data: answers as any
        });

        if (res?.subscription) {
            showToast({ severity: 'success', summary: '问卷更新成功' });
            setQuestionnaireVisible(false);
        } else {
            showToast({ severity: 'error', summary: '问卷更新失败' });
        }
    }

    return (
        <div className="bg-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 左侧 - 教练头像和徽章 */}
                    <div className="flex-shrink-0 text-center">
                        <div className="relative inline-block">
                            {coach.avatar_url ? (
                                <div className="w-32 h-32 rounded-full overflow-hidden mx-auto">
                                    <Image
                                        src={coach.avatar_url}
                                        alt={coach.name}
                                        width={128}
                                        height={128}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <Avatar
                                    label={coach.name?.substring(0, 1).toUpperCase() || 'CN'}
                                    shape="circle"
                                    size="xlarge"
                                    className="text-4xl text-surface-100 w-32 h-32 bg-gradient-to-r from-primary-500 to-red-600 rounded-full flex items-center justify-center mb-4"
                                />
                            )}
                            {coach.is_featured && (
                                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 shadow-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* 右侧 - 教练详细信息 */}
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div className='flex flex-row items-center gap-2'>
                                <h1 className="text-2xl font-bold text-surface-900 mb-2">{coach.name}</h1>
                                {coach.title && (
                                    <span className="text-sm text-surface-500 mb-2">{coach.title}</span>
                                )}
                                {userSubscription?.status === 'active' && (
                                    <div className="inline-flex items-center px-3 py-1 mb-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        已订阅
                                    </div>
                                )}

                                {userSubscription?.status === 'waiting' && (
                                    <div className="inline-flex items-center px-3 py-1 mb-2 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        等待教练确认
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-row gap-2 items-center">
                                {/* 联系教练按钮 */}

                                {['waiting', 'active'].includes(userSubscription?.status) && (
                                    <Button
                                        label="查看问卷"
                                        size='small'
                                        text
                                        icon="pi pi-comments"
                                        className="p-button-primary"
                                        loading={questionnaireLoading}
                                        disabled={questionnaireLoading}
                                        onClick={openQuestionnaire}
                                    />
                                )}

                                <Button
                                    label="联系教练"
                                    size='small'
                                    icon="pi pi-comments"
                                    className="p-button-primary"
                                    loading={loading}
                                    disabled={loading}
                                    onClick={contactCoach}
                                />
                                {/* 编辑按钮 - 仅在查看自己的资料时显示 */}
                                {isOwnProfile && (
                                    <Button
                                        icon="pi pi-pencil"
                                        rounded
                                        outlined
                                        onClick={() => setEditDialogVisible(true)}
                                        tooltip="编辑个人资料"
                                        tooltipOptions={{ position: 'left' }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 统计信息 */}
                        <div className="flex flex-wrap gap-4 mb-6 text-sm">
                            <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-surface-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className="text-surface-900 font-medium">
                                    {aggregatedInfo?.contentCount || 0}
                                </span>
                                <span className="text-surface-500 ml-1">教学内容</span>
                            </div>

                            <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-surface-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-surface-900 font-medium">
                                    {aggregatedInfo?.studentCount || 0}
                                </span>
                                <span className="text-surface-500 ml-1">学员</span>
                            </div>

                            <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-surface-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                <span className="text-surface-900 font-medium">
                                    {aggregatedInfo?.averageRating?.toFixed(1) || '0.0'}
                                </span>
                                <span className="text-surface-500 ml-1">评分</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-surface-900 mb-2">专业领域</h3>
                            <div className="flex flex-wrap gap-2">
                                {specialtiesToShow.map((specialty, index) => (
                                    <Tag key={index} value={specialty} rounded />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h3 className="text-sm font-medium text-surface-900 mb-2">教学经验</h3>
                                <p className="text-surface-600">
                                    {coach.years_experience
                                        ? `${coach.years_experience}年专业教练经验`
                                        : '暂无经验信息'}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-surface-900 mb-2">代表案例</h3>
                                <p className="text-surface-600">
                                    {caseStudyCount > 0 ? `${caseStudyCount} 个案例` : '暂无案例信息'}
                                </p>
                            </div>
                        </div>

                        {/* 教练简介 */}
                        <div>
                            <h3 className="text-sm font-medium text-surface-900 mb-2">教练简介</h3>
                            <p className="text-surface-600 whitespace-pre-line">
                                {coach.bio || '暂无简介'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <EditCoachProfileDialog
                visible={editDialogVisible}
                onHide={() => setEditDialogVisible(false)}
                coach={coach}
                onSave={() => window.location.reload()} // 简单实现，刷新页面以获取最新数据
            />

            <ChatDialog
                visible={chatDialogVisible}
                chatroom={chatroom}
                onHide={() => setChatDialogVisible(false)}
            />
            
            <QuestionnaireForm
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                coach={coach}
                onSubmit={handleQuestionnaireSubmit}
                loading={false}
            />
        </div>
    );
};

export default CoachIntroduction;