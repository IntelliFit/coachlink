'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';
import { Chip } from 'primereact/chip';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

interface EditCoachProfileDialogProps {
    visible: boolean;
    onHide: () => void;
    coach: CoachesRow;
    onSave: () => void;
}

const EditCoachProfileDialog: React.FC<EditCoachProfileDialogProps> = ({ visible, onHide, coach, onSave }) => {
    const toast = useRef<Toast>(null);
    const [loading, setLoading] = useState(false);

    // 教练个人信息字段
    const [bio, setBio] = useState('');
    const [teachingPhilosophy, setTeachingPhilosophy] = useState('');
    const [achievements, setAchievements] = useState<string[]>([]);
    const [newAchievement, setNewAchievement] = useState('');

    // 初始化表单数据
    useEffect(() => {
        if (visible && coach) {
            setBio(coach.bio || '');

            // 从profile字段中提取教学理念和成就奖项
            if (coach.profile) {
                const profile = coach.profile as Record<string, any>;
                setTeachingPhilosophy(profile.teachingPhilosophy || '');
                setAchievements(Array.isArray(profile.achievements) ? profile.achievements : []);
            } else {
                setTeachingPhilosophy('');
                setAchievements([]);
            }
        }
    }, [visible, coach]);

    const handleAddAchievement = () => {
        if (newAchievement.trim() !== '') {
            setAchievements([...achievements, newAchievement.trim()]);
            setNewAchievement('');
        }
    };

    const handleRemoveAchievement = (index: number) => {
        const newAchievements = [...achievements];
        newAchievements.splice(index, 1);
        setAchievements(newAchievements);
        return true;
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 构造要更新的profile对象
            const profile = {
                teachingPhilosophy,
                achievements
            };

            // 调用服务更新教练信息
            const result = await coachService.updateCoachProfile({
                id: coach.id,
                bio,
                profile
            });

            if (result) {
                toast.current?.show({
                    severity: 'success',
                    summary: '成功',
                    detail: '教练信息已更新'
                });

                // 保存成功后回调
                onSave();
                onHide();
            }
        } catch (error: any) {
            console.error('更新教练信息失败:', error);
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: error.message || '更新教练信息失败'
            });
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div>
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text" />
            <Button label="保存" icon="pi pi-check" onClick={handleSubmit} loading={loading} />
        </div>
    );

    return (
        <>
            <Toast ref={toast} />
            <ConfirmDialog />
            <Dialog
                header="编辑教练信息"
                visible={visible}
                style={{ width: '50vw' }}
                onHide={onHide}
                footer={footer}
            >
                <div className="space-y-6">
                    <div>
                        <label htmlFor="bio" className="block text-sm font-medium text-surface-900 mb-2">
                            教练简介
                        </label>
                        <InputTextarea
                            id="bio"
                            value={bio || ''}
                            onChange={(e) => setBio(e.target.value)}
                            rows={4}
                            className="w-full"
                        />

                    </div>

                    <div>
                        <label htmlFor="teachingPhilosophy" className="block text-sm font-medium text-surface-900 mb-2">
                            教学理念
                        </label>
                        <InputTextarea
                            id="teachingPhilosophy"
                            value={teachingPhilosophy || ''}
                            onChange={(e) => setTeachingPhilosophy(e.target.value)}
                            rows={4}
                            className="w-full"
                        />

                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            成就奖项
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {achievements.map((achievement, index) => (
                                <Chip
                                    key={index}
                                    label={achievement}
                                    removable
                                    onRemove={() => handleRemoveAchievement(index)}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newAchievement}
                                onChange={(e) => setNewAchievement(e.target.value)}
                                placeholder="输入成就奖项"
                                className="flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddAchievement()}
                            />
                            <Button
                                icon="pi pi-plus"
                                onClick={handleAddAchievement}
                                disabled={!newAchievement.trim()}
                            />
                        </div>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default EditCoachProfileDialog;