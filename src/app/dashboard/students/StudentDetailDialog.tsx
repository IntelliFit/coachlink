'use client';

import { Dialog } from 'primereact/dialog';
import { Avatar } from 'primereact/avatar';
import { StudentSubscription } from '@/app/api/coach/list-students/entity';
import {
    Calendar, User, Target, Video,
    MessageCircle, FileText, Info,
    ChevronRight, Activity, Clock, X,
    MessageSquare
} from 'lucide-react';
import { CoachesRow } from '@/types';
import { Button } from 'primereact/button';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';

interface StudentDetailDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription | null;
    onHide: () => void;
    onShowReviewDialog?: () => void;
    onShowChatDialog?: () => void;
}

export const StudentDetailDialog = ({ visible, coach, student, onHide, onShowReviewDialog, onShowChatDialog }: StudentDetailDialogProps) => {
    const profile = student?.profile;

    if (!student) return null;

    const getPendingReviews = () => student.uploaded - student.reviewed;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const tierConfig = {
        3: { label: '全能指导版', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        2: { label: '专业指导版', color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-100' },
        1: { label: '特惠版', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
    }[Number(student.tier)] || { label: '基础套餐', color: 'text-surface-600', bg: 'bg-surface-50', border: 'border-surface-100' };

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            style={{ width: '880px' }}
            modal
            draggable={false}
            showHeader={false}
            contentClassName="p-0 rounded-lg overflow-hidden bg-surface"
        >
            {/* 1. Header & Quick Info Profile */}
            <div className="relative">
                {/* 装饰背景 */}
                <div className="absolute top-0 left-0 right-0 h-32" />
                
                <div className="relative pt-12 px-8 pb-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-6 items-end">
                            <div className="relative">
                                <Avatar
                                    image={profile?.avatar_url}
                                    label={!profile?.avatar_url ? profile?.nickname?.charAt(0) : undefined}
                                    className="w-24 h-24 rounded-[28px] shadow-xl shadow-surface-200/50 border-4 border-surface text-3xl font-black bg-primary text-surface"
                                />
                                <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-surface shadow-sm" />
                            </div>
                            <div className="pb-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-3xl font-black tracking-tighter text-surface-900">
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
                        <div className="flex gap-2">
                            <Button
                                label="评价"
                                icon={<MessageSquare size={16} className="mr-2" />}
                                text
                                className="text-xs uppercase rounded-xl hover:bg-primary-50 transition-all active:scale-95"
                                onClick={() => {
                                    onShowReviewDialog?.();
                                    onHide();
                                }}
                            />
                            <Button
                                label="交流"
                                icon={<MessageSquare size={16} className="mr-2" />}
                                outlined
                                className="text-xs uppercase rounded-xl hover:bg-primary-50 transition-all active:scale-95"
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
                                <p className="text-xs font-black text-surface-700">{formatDate(student.start_date)}</p>
                            </div>
                        </div>
                        <div className="bg-surface-50/50 p-3 rounded-2xl border border-surface-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-orange-500 shadow-sm"><Clock size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">剩余时长</p>
                                <p className="text-xs font-black text-surface-700">{student.end_date ? '12 周' : '长期'}</p>
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
                </div>
            </div>

            <div className="p-8 space-y-12 max-h-[65vh] overflow-y-auto bg-surface custom-scrollbar">
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

                {/* 5. Subscription Questionnaire - Chat-style UI */}
                {student.subscribe_data?.answers?.length > 0 && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                            <h3 className="text-lg font-black tracking-tight text-surface-900 uppercase">入营需求问卷</h3>
                        </div>

                        <div className="space-y-4">
                            {student.subscribe_data.answers.map((item, index) => (
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
                                                    “ {item.answer} ”
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
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
    );
};