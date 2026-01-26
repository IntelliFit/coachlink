'use client';

import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Avatar } from 'primereact/avatar';
import { StudentSubscription } from '@/app/api/coach/list-students/entity';
import { subscriptionService } from '@/app/service/subscriptionService';
import {
    Calendar, User, Target, Video,
    MessageCircle, FileText, Info,
    ChevronRight, Activity, Clock, X,
    MessageSquare, History, Edit2, Check
} from 'lucide-react';
import { CoachesRow } from '@/types';
import { Button } from 'primereact/button';
import { Calendar as PRCalendar } from 'primereact/calendar';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';
import { E1RMProgressChart } from '@/components/student/profile/E1RMProgressChart';
import { StudentPlanHistory } from '@/components/coach/StudentPlanHistory';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { useToastContext } from '@/context/ToastContext';
import { AeroInputNumber } from '@/components/AeroInputNumber';


interface StudentDetailDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription | null;
    onHide: () => void;
    onShowReviewDialog?: () => void;
    onShowChatDialog?: () => void;
    onStudentUpdate?: (updatedStudent: Partial<StudentSubscription>) => void;
}

export const StudentDetailDialog = ({ visible, coach, student, onHide, onShowReviewDialog, onShowChatDialog, onStudentUpdate }: StudentDetailDialogProps) => {
    const profile = student?.profile;
    
    // 编辑prior_training_weeks的状态
    const [isEditingPriorWeeks, setIsEditingPriorWeeks] = useState(false);
    const [priorWeeksValue, setPriorWeeksValue] = useState<number | null>(student?.prior_training_weeks ?? 0);
    const [isSavingPriorWeeks, setIsSavingPriorWeeks] = useState(false);

    // End Date Editing
    const [isEditingEndDate, setIsEditingEndDate] = useState(false);
    const [endDateValue, setEndDateValue] = useState<Date | null>(student?.end_date ? new Date(student.end_date) : null);
    const [isSavingEndDate, setIsSavingEndDate] = useState(false);

    // 问卷编辑状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    const { showToast } = useToastContext();

    const parseDateSafe = (value: string | null | undefined) => {
        if (!value) return null;
        const d = new Date(value as any);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const formatDate = (value: string | null | undefined, fallback: string = '未开始') => {
        const d = parseDateSafe(value);
        if (!d) return fallback;
        return d.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // 当切换学员时，重置编辑态和编辑值，避免“上一个学员的值”残留
    useEffect(() => {
        if (!student) return;
        setIsEditingPriorWeeks(false);
        setIsSavingPriorWeeks(false);
        setPriorWeeksValue(student.prior_training_weeks ?? 0);

        setIsEditingEndDate(false);
        setIsSavingEndDate(false);
        setEndDateValue(student.end_date ? new Date(student.end_date as any) : null);
    }, [student?.id]);

    // 保存prior_training_weeks
    const savePriorTrainingWeeks = async () => {
        if (!student) return;
        setIsSavingPriorWeeks(true);
        try {
            await subscriptionService.updateSubscription({
                id: student.id,
                prior_training_weeks: priorWeeksValue,
            });
            onStudentUpdate?.({ ...student, prior_training_weeks: priorWeeksValue });
            setIsEditingPriorWeeks(false);
        } catch (error) {
            console.error('保存失败:', error);
        } finally {
            setIsSavingPriorWeeks(false);
        }
    };

    const getRemainingDuration = () => {
        const startDate = parseDateSafe(student?.start_date ?? null);
        
        // 如果还没开始训练，显示"未开始"
        if (!startDate) {
            return '未开始';
        }
        
        const endDate = parseDateSafe(student?.end_date ?? null);
        const now = new Date();
        
        // 如果有 end_date（系统计算的预计完成日），显示预计剩余时间
        if (endDate) {
            const diff = endDate.getTime() - now.getTime();
            if (diff < 0) {
                return '已过期';
            }
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days < 7) {
                return `预计剩余 ${days} 天`;
            }
            const weeks = Math.floor(days / 7);
            const remainingDays = days % 7;
            if (remainingDays === 0) {
                return `预计剩余 ${weeks} 周`;
            }
            return `预计剩余 ${weeks} 周 ${remainingDays} 天`;
        }
        
        // 如果没有 end_date，但已开始训练，根据 subscribed_weeks 估算
        // 注意：这是粗略估算，实际应该由后端根据 credits 计算
        const subscribedWeeks = student?.subscribed_weeks ?? 0;
        if (subscribedWeeks > 0) {
            // 粗略估算：假设每周训练 3 次，从开始日期算起
            const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const elapsedWeeks = Math.floor(elapsedDays / 7);
            const remainingWeeks = Math.max(0, subscribedWeeks - elapsedWeeks);
            if (remainingWeeks > 0) {
                return `预计剩余约 ${remainingWeeks} 周（估算）`;
            } else {
                return '预计已完成';
            }
        }
        
        // 兜底：无法确定
        return '待计算';
    };

    const saveEndDate = async () => {
        if (!student) return;
        setIsSavingEndDate(true);
        try {
            await subscriptionService.updateSubscription({
                id: student.id,
                end_date: endDateValue ? endDateValue.toISOString() : null,
            });
            onStudentUpdate?.({ ...student, end_date: endDateValue ? endDateValue.toISOString() : null });
            setIsEditingEndDate(false);
            showToast({ severity: 'success', summary: '更新成功' });
        } catch (error) {
            console.error('保存失败:', error);
            showToast({ severity: 'error', summary: '保存失败' });
        } finally {
            setIsSavingEndDate(false);
        }
    };

    // 打开问卷编辑
    const handleOpenQuestionnaire = async () => {
        setQuestionnaireLoading(true);
        try {
            const qRes = await coachService.getQuestionnaires({ coachId: coach.id });
            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '暂无问卷配置' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    // 保存问卷
    const handleSaveQuestionnaire = async (answers: TrainingItem[]) => {
        try {
            const res = await fetch('/api/subscription/update-questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: student.id, subscribeData: answers })
            });
            if (res.ok) {
                showToast({ severity: 'success', summary: '问卷更新成功' });
                setQuestionnaireVisible(false);
                onStudentUpdate?.({ ...student, subscribe_data: { answers } as any });
            } else {
                showToast({ severity: 'error', summary: '问卷更新失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败' });
        }
    };

    if (!student) return null;

    const getPendingReviews = () => student.uploaded - student.reviewed;

    // 计算总训练周数
    const getTotalTrainingWeeks = () => {
        const priorWeeks = student.prior_training_weeks || 0;
        const startDate = parseDateSafe(student.start_date);
        if (!startDate) {
            // 没有开始日期：只显示迁入前周数，平台内为 0
            return priorWeeks;
        }
        const now = new Date();
        // 若已设置 end_date 且已过期，则平台内周数用 end_date 截止，避免“无限增长”
        const endDate = parseDateSafe(student.end_date);
        const effectiveEnd = endDate && endDate.getTime() < now.getTime() ? endDate : now;
        const platformWeeks = Math.floor((effectiveEnd.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return priorWeeks + Math.max(0, platformWeeks);
    };

    const tierConfig = {
        3: { label: '全能指导版', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        2: { label: '专业指导版', color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-100' },
        1: { label: '特惠版', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
    }[Number(student.tier)] || { label: '基础套餐', color: 'text-surface-600', bg: 'bg-surface-50', border: 'border-surface-100' };


    return (
        <>
        <Dialog
            visible={visible}
            onHide={onHide}
            style={{ width: '96vw', maxWidth: '880px', height: '92vh' }}
            modal
            draggable={false}
            showHeader={false}
            contentClassName="p-0 rounded-2xl overflow-y-auto bg-surface"
        >
            {/* 1. Header & Quick Info Profile */}
            <div className="relative">
                {/* 装饰背景 */}
                <div className="absolute top-0 left-0 right-0 h-32" />
                
                <div className="relative pt-4 sm:pt-12 px-4 sm:px-8 pb-4 sm:pb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="flex gap-4 sm:gap-6 items-end min-w-0">
                            <div className="relative">
                                <Avatar
                                    image={profile?.avatar_url}
                                    label={!profile?.avatar_url ? profile?.nickname?.charAt(0) : undefined}
                                    className="w-16 h-16 sm:w-24 sm:h-24 rounded-[22px] sm:rounded-[28px] shadow-xl shadow-surface-200/50 border-4 border-surface text-xl sm:text-3xl font-black bg-primary text-surface"
                                />
                                <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-surface shadow-sm" />
                            </div>
                            <div className="pb-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1 min-w-0">
                                    <h2 className="text-xl sm:text-3xl font-black tracking-tighter text-surface-900 truncate">
                                        {profile?.nickname || '未命名学员'}
                                    </h2>
                                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${tierConfig.bg} ${tierConfig.color} ${tierConfig.border}`}>
                                        {tierConfig.label}
                                    </div>
                                </div>
                                <p className="text-surface-400 text-sm font-medium flex items-center gap-2">
                                    <Activity size={14} /> 订阅 ID: {student.id.split('-')[0].toUpperCase()}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                            <Button
                                label="评价"
                                icon={<MessageSquare size={16} className="mr-2" />}
                                text
                                className="text-xs uppercase rounded-xl hover:bg-primary-50 transition-all active:scale-95 [&_.p-button-label]:hidden sm:[&_.p-button-label]:inline [&_.mr-2]:mr-0 sm:[&_.mr-2]:mr-2"
                                onClick={() => {
                                    onShowReviewDialog?.();
                                    onHide();
                                }}
                            />
                            <Button
                                label="交流"
                                icon={<MessageSquare size={16} className="mr-2" />}
                                outlined
                                className="text-xs uppercase rounded-xl hover:bg-primary-50 transition-all active:scale-95 [&_.p-button-label]:hidden sm:[&_.p-button-label]:inline [&_.mr-2]:mr-0 sm:[&_.mr-2]:mr-2"
                                onClick={() => {
                                    onShowChatDialog?.();
                                    onHide();
                                }}
                            />
                            <Button
                                icon={<X size={20} />}
                                className="p-button-text p-button-secondary rounded-2xl w-10 h-10 hover:bg-surface-100 transition-all"
                                onClick={onHide}
                            />
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-surface-50/50 p-3 rounded-2xl border border-surface-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-primary shadow-sm"><Calendar size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">开始日期</p>
                                <p className="text-xs font-black text-surface-700">{formatDate(student.start_date, '未开始')}</p>
                            </div>
                        </div>
                        <div className="bg-surface-50/50 p-3 rounded-2xl border border-surface-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-orange-500 shadow-sm"><Clock size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">剩余时长</p>
                                <div className="flex items-center gap-1">
                                    {isEditingEndDate ? (
                                        <div className="flex items-center gap-1">
                                            <PRCalendar 
                                                value={endDateValue} 
                                                onChange={(e) => setEndDateValue(e.value as Date)} 
                                                className="w-24 h-6 text-xs" 
                                                inputClassName="p-1 px-2 text-xs font-black"
                                                dateFormat="yy/mm/dd"
                                            />
                                              <Button
                                                icon={<Check size={12} />}
                                                className="p-button-success p-button-sm w-6 h-6 rounded-md p-0"
                                                onClick={saveEndDate}
                                                loading={isSavingEndDate}
                                            />
                                            <Button
                                                icon={<X size={12} />}
                                                className="p-button-secondary p-button-text p-button-sm w-6 h-6 rounded-md p-0"
                                                onClick={() => {
                                                    setIsEditingEndDate(false);
                                                    setEndDateValue(student.end_date ? new Date(student.end_date) : null);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingEndDate(true)}>
                                            <p className="text-xs font-black text-surface-700">{getRemainingDuration()}</p>
                                            <Edit2 size={12} className="text-primary opacity-70 hover:opacity-100 transition-all" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-surface-50/50 p-3 rounded-2xl border border-surface-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-blue-500 shadow-sm"><Video size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">总上传视频</p>
                                <p className="text-xs font-black text-surface-700">{student.uploaded} 个</p>
                            </div>
                        </div>
                        <div className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${getPendingReviews() > 0 ? 'bg-amber-50 border-amber-100' : 'bg-surface-50/50 border-surface-100'}`}>
                            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-amber-600 shadow-sm"><MessageCircle size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">待评阅</p>
                                <p className={`text-xs font-black ${getPendingReviews() > 0 ? 'text-amber-700' : 'text-surface-700'}`}>
                                    {getPendingReviews()} 份
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 训练时长统计栏 - 可编辑 */}
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-purple-600 shadow-sm">
                                    <History size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-purple-600 uppercase tracking-tight">总跟随周数</p>
                                    <p className="text-lg font-black text-surface-900">
                                        {getTotalTrainingWeeks()} 周
                                        <span className="text-xs font-medium text-surface-400 ml-2">
                                            (平台前 {student.prior_training_weeks || 0} 周 + 平台内)
                                        </span>
                                    </p>
                                </div>
                            </div>
                            
                            {/* 编辑按钮或编辑表单 */}
                            <div className="flex items-center gap-2">
                                {isEditingPriorWeeks ? (
                                    <>
                                        <AeroInputNumber
                                            value={priorWeeksValue}
                                            onValueChange={(e) => setPriorWeeksValue(e.value ?? 0)}
                                            min={0}
                                            max={520}
                                            suffix=" 周"
                                            inputClassName="w-20 text-center text-sm font-bold"
                                            className="p-inputtext-sm"
                                        />
                                        <Button
                                            icon={<Check size={16} />}
                                            className="p-button-success p-button-sm rounded-xl"
                                            onClick={savePriorTrainingWeeks}
                                            loading={isSavingPriorWeeks}
                                            tooltip="保存"
                                        />
                                        <Button
                                            icon={<X size={16} />}
                                            className="p-button-secondary p-button-text p-button-sm rounded-xl"
                                            onClick={() => {
                                                setIsEditingPriorWeeks(false);
                                                setPriorWeeksValue(student.prior_training_weeks ?? 0);
                                            }}
                                            tooltip="取消"
                                        />
                                    </>
                                ) : (
                                    <Button
                                        icon={<Edit2 size={14} />}
                                        label="编辑迁入前周数"
                                        className="p-button-text p-button-sm text-purple-600 hover:bg-purple-100 rounded-xl"
                                        onClick={() => setIsEditingPriorWeeks(true)}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-8 space-y-8 sm:space-y-12 bg-surface custom-scrollbar">
                {/* 2. Personal Profile Sections */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                        <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">身体素质档案</h3>
                    </div>
                    <div className="">
                        <PersonalInfoDisplay profile={profile || null} phone={profile?.phone} />
                    </div>
                </section>

                {/* 3. Sport Cards */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                        <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">专项运动表现</h3>
                    </div>
                    <SportCardsDisplay sportCards={profile?.sport_cards as any} />
                </section>

                {/* 3.5 Strength Progress Curve */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                        <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">力量进步曲线</h3>
                    </div>
                    <div className="bg-surface rounded-[32px] border border-surface-100 p-4">
                        <E1RMProgressChart studentId={student.student_id} coachId={coach.id} />
                    </div>
                </section>

                {/* 4. Timeline */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                        <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">近期进步足迹</h3>
                    </div>
                    <div className="bg-surface rounded-[32px] border border-surface-100 p-2">
                        <CoachViewProgressTimeline studentId={student.student_id} limit={10} />
                    </div>
                </section>

                {/* 5. Plan History - 计划历史 */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                        <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">计划历史</h3>
                    </div>
                    <div className="bg-surface rounded-[32px] border border-surface-100 p-4">
                        <StudentPlanHistory studentId={student.student_id} limit={5} />
                    </div>
                </section>

                {/* 6. Subscription Questionnaire - Chat-style UI */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                            <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">入营需求问卷</h3>
                        </div>
                        <Button
                            label="编辑问卷"
                            icon={<Edit2 size={14} className="mr-1" />}
                            size="small"
                            text
                            severity="warning"
                            onClick={handleOpenQuestionnaire}
                            loading={questionnaireLoading}
                            className="text-xs"
                        />
                    </div>

                    {(() => {
                        // 兼容两种 subscribe_data 结构：
                        // 1) 旧结构：{ answers: [{ question, answer }] }
                        // 2) 新结构：TrainingItem[]（tags/times/rm/option/text...）
                        const sd: any = student.subscribe_data as any;

                        const getQuestionText = (item: any) => {
                            if (item?.question && String(item.question).trim()) return String(item.question);
                            switch (item?.type) {
                                case 'tags':
                                    return '请选择您偏好的训练项目（可多选）';
                                case 'times':
                                    return '您希望每周训练几次？';
                                case 'rm':
                                    return '请输入以下动作您的极限重量';
                                default:
                                    return '未命名问卷项';
                            }
                        };

                        const getAnswerText = (item: any) => {
                            // 旧结构
                            if (typeof item?.answer === 'string') return item.answer;

                            // 新结构（TrainingItem）
                            switch (item?.type) {
                                case 'tags': {
                                    const selections = Array.isArray(item.userSelections) ? item.userSelections : [];
                                    return selections.length > 0 ? selections.join('、') : '未选择';
                                }
                                case 'times': {
                                    const v = item.userSelection;
                                    return typeof v === 'number' ? `${v} 次/每周` : '未填写';
                                }
                                case 'rm': {
                                    const inputs = item.userInputs;
                                    const hasAny =
                                        inputs &&
                                        typeof inputs === 'object' &&
                                        Object.values(inputs).some((n: any) => typeof n === 'number' && n > 0);
                                    return hasAny ? '已填写 RM 数据' : '未填写';
                                }
                                case 'option': {
                                    if (typeof item.userSelection === 'number') {
                                        const opts = Array.isArray(item.options) ? item.options : [];
                                        return opts[item.userSelection] ?? `选项 ${item.userSelection + 1}`;
                                    }
                                    return '未填写';
                                }
                                case 'text': {
                                    return typeof item.userSelection === 'string' && item.userSelection.trim()
                                        ? item.userSelection
                                        : '未填写';
                                }
                                default: {
                                    if (typeof item.userSelection === 'string') return item.userSelection;
                                    if (typeof item.userSelection === 'number') return String(item.userSelection);
                                    return '未填写';
                                }
                            }
                        };

                        const normalized: { question: string; answer: string }[] = Array.isArray(sd)
                            ? sd.map((it: any) => ({ question: getQuestionText(it), answer: getAnswerText(it) }))
                            : Array.isArray(sd?.answers)
                                ? sd.answers.map((it: any) => ({
                                    question: it?.question ? String(it.question) : '未命名问卷项',
                                    answer: it?.answer ? String(it.answer) : '未填写'
                                }))
                                : [];

                        if (normalized.length === 0) return null;

                        return (
                        <div className="space-y-4">
                            {normalized.map((item, index) => (
                                <div key={index} className="group relative flex flex-col gap-2 p-5 rounded-[24px] bg-surface-50/50 border border-surface-100 hover:border-primary-100 hover:bg-surface transition-all">
                                    <div className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-surface border border-surface-200 flex items-center justify-center text-[10px] font-black text-surface-400 group-hover:text-primary group-hover:border-primary-200 transition-colors">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <div className="space-y-3 flex-1">
                                            <p className="text-sm font-black text-surface-800 leading-tight">
                                                {item.question}
                                            </p>
                                            <div className="relative pl-4 border-l-2 border-surface-200 group-hover:border-primary-200 transition-colors">
                                                <p className="text-sm text-surface-600 font-medium italic">
                                                    " {item.answer} "
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        );
                    })()}
                </section>
            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-surface-50 flex justify-end bg-surface">
                <Button 
                    label="完成查阅" 
                    onClick={onHide} 
                    className="p-button-secondary p-button-text font-black text-sm uppercase tracking-widest px-8 rounded-2xl"
                />
            </div>
        </Dialog>

        {/* 问卷编辑对话框 */}
        <QuestionnaireForm
            visible={questionnaireVisible}
            onHide={() => setQuestionnaireVisible(false)}
            questions={questionnaireQuestions}
            coach={coach as any}
            onSubmit={handleSaveQuestionnaire}
            loading={questionnaireLoading}
            existingAnswers={student.subscribe_data as any}
        />
        </>
    );
};