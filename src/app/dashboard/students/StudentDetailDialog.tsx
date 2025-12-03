import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { StudentSubscription } from '@/app/api/coach/get-students/entity';
import { CoachesRow, CoachSubscriptionRow } from '@/types';
import { useEffect, useState } from 'react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';

interface StudentDetailDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription | null;
    onHide: () => void;
}

export const StudentDetailDialog = ({ visible, coach, student, onHide }: StudentDetailDialogProps) => {
    // 对话框页脚
    const dialogFooter = (
        <Button 
            label="关闭" 
            icon="pi pi-times" 
            onClick={onHide} 
            className="p-button-text"
        />
    );

    return (
        <Dialog
            header={student ? `学员详情 - ${student.profile?.nickname || student.profile?.phone}` : "学员详情"}
            visible={visible}
            style={{ width: '500px' }}
            onHide={onHide}
            footer={dialogFooter}
        >
            {student && (
                <div className="p-4">
                    <div className="flex items-center mb-6">
                        <Avatar
                            image={student.profile?.avatar_url || undefined}
                            label={
                                student.profile?.avatar_url
                                    ? undefined
                                    : student.profile?.nickname?.charAt(0) ||
                                    student.profile?.phone?.slice(0, 1) ||
                                    'U'
                            }
                            size="xlarge"
                            shape="circle"
                            className="bg-primary text-surface font-bold mr-4"
                        />
                        <div>
                            <div className="text-xl font-semibold">
                                {student.profile?.nickname || '未设置昵称'}
                            </div>
                            <div className="text-surface-500">
                                {student.profile?.phone || '未设置手机号'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-surface-500 text-sm mb-1">订阅等级</div>
                            <div className="font-medium">{student.tier}</div>
                        </div>
                        <div>
                            <div className="text-surface-500 text-sm mb-1">订阅状态</div>
                            <div className="font-medium capitalize">{student.status}</div>
                        </div>
                        <div>
                            <div className="text-surface-500 text-sm mb-1">开始日期</div>
                            <div className="font-medium">
                                {new Date(student.start_date).toLocaleDateString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-surface-500 text-sm mb-1">健身水平</div>
                            <div className="font-medium">
                                {student.profile?.fitness_level || '未设置'}
                            </div>
                        </div>
                        <div>
                            <div className="text-surface-500 text-sm mb-1">上传视频</div>
                            <div className="font-medium">
                                {student.uploaded} 个
                            </div>
                        </div>
                        <div>
                            <div className="text-surface-500 text-sm mb-1">待评阅视频</div>
                            <div className="font-medium">
                                {student.uploaded - student.reviewed} 个
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
};