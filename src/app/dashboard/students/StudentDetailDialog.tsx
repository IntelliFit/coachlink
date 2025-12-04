import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Tag } from 'primereact/tag';
import { StudentSubscription } from '@/app/api/coach/get-students/entity';
import { Calendar, User, Target, Video, MessageCircle } from 'lucide-react';
import { CoachesRow } from '@/types';

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

    const fitnessLevelString = (fitnessLevel: string) => {
        if (fitnessLevel === 'beginner') {
            return '初级';
        } else if (fitnessLevel === 'intermediate') {
            return '中级';
        } else if (fitnessLevel === 'advanced') {
            return '高级';
        } else {
            return fitnessLevel;
        }
    }

    return (
        <Dialog
            header={getHeader()}
            visible={visible}
            style={{ width: '650px', maxWidth: '90vw' }}
            className="student-detail-dialog"
            modal
            draggable={false}
            onHide={onHide}
        >
            {student && (
                <div className="p-5">
                    {/* 用户信息头部卡片 */}
                    <div className="flex items-start mb-8 p-4 bg-surface-50 rounded-xl border border-surface-200">
                        <Avatar
                            image={profile?.avatar_url}
                            label={getAvatarLabel()}
                            size="xlarge"
                            shape="circle"
                            className="mr-4 bg-gradient-to-br from-primary to-primary-600 text-surface font-bold shadow-md"
                        />

                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-2xl font-bold text-surface-900">
                                    {profile?.nickname || '未设置昵称'}
                                </h2>
                                <Tag
                                    value={student.status.toUpperCase()}
                                    severity={getStatusSeverity(student.status)}
                                    className="font-medium"
                                />
                            </div>

                            <div className="text-surface-600 mb-3">
                                <span className="flex items-center gap-2">
                                    <User size={16} />
                                    {profile?.phone || '未设置手机号'}
                                </span>
                            </div>

                            <div className="text-surface-700">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                                    <Target size={14} />
                                    订阅套餐等级 {student.tier}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 订阅问卷部分 */}
                    {student.subscribe_data?.answers?.length > 0 && (
                        <div className="mt-8 mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-6 bg-primary rounded-full"></div>
                                <h3 className="text-xl font-bold text-surface-900">订阅问卷</h3>
                                <span className="ml-2 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-semibold rounded">
                                    {student.subscribe_data.answers.length} 项
                                </span>
                            </div>

                            <div className="space-y-4">
                                {student.subscribe_data.answers.map((item, index) => (
                                    <div
                                        key={`question-${index}`}
                                        className="p-4 bg-surface-50 rounded-lg border border-surface-200 hover:border-primary-200 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 text-sm font-bold rounded-full">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-surface-700 mb-1.5">
                                                    {item.question}
                                                </div>
                                                <div className="text-surface-900 bg-surface p-3 rounded border border-surface-100">
                                                    {item.answer}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 详细信息网格 */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <InfoCard
                            icon={<Calendar className="text-primary" size={20} />}
                            label="开始日期"
                            value={formatDate(student.start_date)}
                        />

                        <InfoCard
                            icon={<Target className="text-green-500" size={20} />}
                            label="健身水平"
                            value={fitnessLevelString(profile?.fitness_level) || '未设置'}
                        />

                        <InfoCard
                            icon={<Video className="text-blue-500" size={20} />}
                            label="已上传视频"
                            value={`${student.uploaded} 个`}
                            badge={student.uploaded > 0 ? "success" : undefined}
                        />

                        <InfoCard
                            icon={<MessageCircle className="text-amber-500" size={20} />}
                            label="待评阅视频"
                            value={`${getPendingReviews()} 个`}
                            badge={getPendingReviews() > 0 ? "warning" : undefined}
                        />
                    </div>
                </div>
            )}
        </Dialog>
    );
};

// 优化后的 InfoCard 组件
interface InfoCardProps {
    icon?: React.ReactNode;
    label: string;
    value: string | number;
    badge?: string;
}

const InfoCard = ({ icon, label, value, badge }: InfoCardProps) => (
    <div className="relative p-4 bg-surface-50 rounded-xl border border-surface-200 hover:bg-surface-100 transition-colors">
        <div className="flex items-start justify-between">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    {icon}
                    <div className="text-sm font-medium text-surface-500">
                        {label}
                    </div>
                </div>
                <div className="text-sm font-bold text-surface-900">
                    {value}
                </div>
            </div>
            {badge && (
                <div className={`w-3 h-3 rounded-full ${badge === 'success' ? 'bg-green-500' :
                    badge === 'warning' ? 'bg-primary-500' : 'bg-blue-500'
                    }`} />
            )}
        </div>
    </div>
);