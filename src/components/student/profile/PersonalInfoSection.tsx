import React, { useState } from 'react';
import { User, Edit } from 'lucide-react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Skeleton } from 'primereact/skeleton';
import { ProfileData } from './types';
import { studentService } from '@/app/service/studentService';
import { useToastContext } from '@/context/ToastContext';
import { differenceInYears, parseISO } from 'date-fns';

interface PersonalInfoSectionProps {
    data: ProfileData;
    onUpdate: () => void;
}

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ data, onUpdate }) => {
    const { user, profile } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToastContext();

    // Calculate age from birth_date
    const calculateAge = (birthDate: string | null) => {
        if (!birthDate) return null;
        return differenceInYears(new Date(), parseISO(birthDate));
    };

    // Form state
    const [formData, setFormData] = useState({
        nickname: profile?.nickname || '',
        birth_date: profile?.birth_date ? new Date(profile.birth_date) : null,
        gender: profile?.gender || '',
        height: profile?.height || null,
        weight: profile?.weight || null,
        fitness_goal: profile?.fitness_goal || '',
        fitness_level: profile?.fitness_level || ''
    });

    const handleSave = async () => {
        try {
            setLoading(true);
            const updateData = {
                ...formData,
                birth_date: formData.birth_date ? formData.birth_date.toISOString().split('T')[0] : null
            };
            await studentService.updateProfile(user.id, updateData);
            showToast({
                severity: 'success',
                summary: '保存成功',
                detail: '个人信息已更新'
            });
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: '无法更新个人信息，请重试'
            });
        } finally {
            setLoading(false);
        }
    };

    const InfoItem = ({ label, value }: { label: string, value: string | number | null }) => (
        <div className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div className="text-sm text-surface-500 mb-1">{label}</div>
            <div className="text-sm font-semibold text-surface-900">{value || '未填写'}</div>
        </div>
    );

    // 渲染信息项骨架屏
    const InfoItemSkeleton = () => (
        <div className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <Skeleton width="40%" height="0.875rem" className="mb-2" />
            <Skeleton width="60%" height="1.25rem" />
        </div>
    );

    const age = calculateAge(profile?.birth_date || null);

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                    <User className="text-primary" size={20} />
                    个人信息
                </h2>
                <Button 
                    label="编辑资料" 
                    icon={<Edit size={16} className="mr-2" />} 
                    text 
                    onClick={() => {
                        setFormData({
                            nickname: profile?.nickname || '',
                            birth_date: profile?.birth_date ? new Date(profile.birth_date) : null,
                            gender: profile?.gender || '',
                            height: profile?.height || null,
                            weight: profile?.weight || null,
                            fitness_goal: profile?.fitness_goal || '',
                            fitness_level: profile?.fitness_level || ''
                        });
                        setIsEditing(true);
                    }}
                />
            </div>

            {/* 显示加载状态的骨架屏 */}
            {!profile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, index) => (
                        <InfoItemSkeleton key={index} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoItem label="昵称" value={profile?.nickname || user.phone || '-'} />
                    <InfoItem label="年龄" value={age ? `${age}岁` : null} />
                    <InfoItem label="性别" value={profile?.gender || null} />
                    <InfoItem label="身高" value={profile?.height ? `${profile.height} cm` : null} />
                    <InfoItem label="体重" value={profile?.weight ? `${profile.weight} kg` : null} />
                    <InfoItem label="健身目标" value={profile?.fitness_goal || null} />
                </div>
            )}

            <Dialog 
                header="编辑个人资料" 
                visible={isEditing} 
                style={{ width: '90vw', maxWidth: '800px' }} 
                onHide={() => setIsEditing(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button label="取消" text onClick={() => setIsEditing(false)} />
                        <Button label="保存" loading={loading} onClick={handleSave} />
                    </div>
                }
            >
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="nickname" className="text-sm font-medium">昵称</label>
                        <InputText 
                            id="nickname" 
                            value={formData.nickname} 
                            onChange={(e) => setFormData({...formData, nickname: e.target.value})} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="birth_date" className="text-sm font-medium">出生日期</label>
                            <Calendar 
                                id="birth_date" 
                                value={formData.birth_date} 
                                onChange={(e) => setFormData({...formData, birth_date: e.value as Date})} 
                                showIcon
                                dateFormat="yy-mm-dd"
                                maxDate={new Date()}
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="gender" className="text-sm font-medium">性别</label>
                            <Dropdown 
                                id="gender" 
                                value={formData.gender} 
                                options={[
                                    { label: '男', value: '男' },
                                    { label: '女', value: '女' },
                                    { label: '其他', value: '其他' }
                                ]} 
                                onChange={(e) => setFormData({...formData, gender: e.value})} 
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="height" className="text-sm font-medium">身高 (cm)</label>
                            <InputNumber 
                                id="height" 
                                value={formData.height} 
                                onValueChange={(e) => setFormData({...formData, height: e.value})} 
                                min={0} max={300}
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="weight" className="text-sm font-medium">体重 (kg)</label>
                            <InputNumber 
                                id="weight" 
                                value={formData.weight} 
                                onValueChange={(e) => setFormData({...formData, weight: e.value})} 
                                min={0} max={500} mode="decimal" minFractionDigits={1}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="fitness_goal" className="text-sm font-medium">健身目标</label>
                        <Dropdown 
                            id="fitness_goal" 
                            value={formData.fitness_goal} 
                            options={[
                                { label: '减脂', value: '减脂' },
                                { label: '增肌', value: '增肌' },
                                { label: '力量提升', value: '力量提升' },
                                { label: '体能改善', value: '体能改善' }
                            ]} 
                            onChange={(e) => setFormData({...formData, fitness_goal: e.value})} 
                            editable
                            placeholder="选择或输入目标"
                            className="w-full"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="fitness_level" className="text-sm font-medium">当前水平</label>
                        <Dropdown 
                            id="fitness_level" 
                            value={formData.fitness_level} 
                            options={[
                                { label: '初学者', value: '初学者' },
                                { label: '中级', value: '中级' },
                                { label: '高级', value: '高级' },
                                { label: '专业运动员', value: '专业运动员' }
                            ]} 
                            onChange={(e) => setFormData({...formData, fitness_level: e.value})} 
                            className="w-full"
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};