import { Dialog } from 'primereact/dialog';
import { Avatar } from 'primereact/avatar';
import { Tag } from 'primereact/tag';
import { StudentSubscription } from '@/app/api/coach/get-students/entity';
import { Calendar, User, Target, Video, MessageCircle, FileText } from 'lucide-react';
import { CoachesRow } from '@/types';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';

interface StudentDetailDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription | null;
    onHide: () => void;
}

export const StudentDetailDialog = ({
    visible,
    coach,
    student,
    onHide
}: StudentDetailDialogProps) => {
    const profile = student?.profile;

    const getHeader = () => {
        if (!student) return "学员详情";
        const displayName = profile?.nickname || profile?.phone || "未知用户";
        return `学员详情 - ${displayName}`;
    };

    const getAvatarLabel = () => {
        if (profile?.avatar_url) return undefined;
        return (
            profile?.nickname?.charAt(0) ||
            profile?.phone?.slice(0, 1) ||
            'U'
        );
    };

    const getPendingReviews = () => {
        if (!student) return 0;
        return student.uploaded - student.reviewed;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getStatusSeverity = (status: string) => {
        const statusMap: Record<string, any> = {
            'active': 'success',
            'expired': 'danger',
            'pending': 'warning',
            'canceled': 'secondary'
        };
        return statusMap[status] || 'info';
    };

    return (
        <Dialog
            header={getHeader()}
            visible={visible}
            style={{ width: '850px', maxWidth: '95vw' }}
            className="student-detail-dialog"
            modal
            draggable={false}
            onHide={onHide}
        >
            {student && (
                <div className="p-4 max-h-[80vh]">
                    {/* 用户信息头部卡片 */}
                    <div className="flex items-start mb-6 p-4 bg-surface-50 rounded-xl border border-surface-200">
                        <Avatar
                            image={profile?.avatar_url}
                            label={getAvatarLabel()}
                            size="xlarge"
                            shape="circle"
                            className="mr-4 bg-gradient-to-br from-primary to-primary-600 text-surface font-bold shadow-md"
                        />

                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="flex flex-row gap-1 items-center text-2xl font-bold text-surface-900">
                                    <User/> {profile?.nickname || '未设置昵称'}
                                </h2>
                                <Tag
                                    value={student.status.toUpperCase()}
                                    severity={getStatusSeverity(student.status)}
                                    className="font-medium"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                                    <Target size={14} />
                                    套餐等级 {student.tier}
                                </span>
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                    <Calendar size={14} />
                                    {formatDate(student.start_date)} 开始
                                </span>
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                                    <Video size={14} />
                                    {student.uploaded} 视频
                                </span>
                                {getPendingReviews() > 0 && (
                                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                                        <MessageCircle size={14} />
                                        {getPendingReviews()} 待评阅
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 个人档案区 - 复用用户端组件 */}
                    <PersonalInfoDisplay profile={profile || null} phone={profile?.phone} />

                    {/* 运动数据卡片 - 复用用户端组件 */}
                    <SportCardsDisplay sportCards={profile?.sport_cards as any} />

                    {/* 进步足迹 - 显示学员的PR记录 */}
                    <CoachViewProgressTimeline studentId={student.student_id} limit={10} />

                    {/* 订阅问卷部分 */}
                    {student.subscribe_data?.answers?.length > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="text-primary" size={18} />
                                <h3 className="text-md font-bold text-surface-900">需求问卷</h3>
                                <span className="ml-2 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-semibold rounded">
                                    {student.subscribe_data.answers.length} 项
                                </span>
                            </div>

                            <div className="space-y-3">
                                {student.subscribe_data.answers.map((item, index) => (
                                    <div
                                        key={`question-${index}`}
                                        className="p-3 bg-surface-50 rounded-lg border border-surface-200"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 text-sm font-bold rounded-full">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-surface-700 mb-1.5">
                                                    {item.question}
                                                </div>
                                                <div className="text-sm text-surface-900 bg-surface p-2 rounded border border-surface-100">
                                                    {item.answer}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Dialog>
    );
};
