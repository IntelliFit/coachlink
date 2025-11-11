import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { UserProfilesRow } from '@/types';
import axios from 'axios';
import { useToastContext } from '../ToastContext';

interface ProfileSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (profile: UserProfilesRow) => void;
    initialProfile?: Partial<UserProfilesRow>;
    userId?: string;
}

interface ProfileFormData {
    full_name: string;
    nickname: string;
    phone: string;
    address: string;
    gender: 'male' | 'female' | 'other' | '' | null;
    birth_date: Date | null;
    height: string;
    weight: string;
    fitness_goal: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced' | '' | null;
    bio: string;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onClose, onComplete, initialProfile, userId }) => {
    const [formData, setFormData] = useState<ProfileFormData>({
        full_name: '',
        nickname: '',
        phone: '',
        address: '',
        gender: '',
        birth_date: null,
        height: '',
        weight: '',
        fitness_goal: '',
        fitness_level: '',
        bio: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const { showToast } = useToastContext();

    // 性别选项
    const genderOptions = [
        { label: '请选择性别', value: '' },
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
        { label: '其他', value: 'other' }
    ];

    // 健身目标选项
    const fitnessGoalOptions = [
        { label: '请选择健身目标', value: '' },
        { label: '减重塑形', value: 'lose_weight' },
        { label: '增肌强身', value: 'gain_muscle' },
        { label: '提升体能', value: 'improve_fitness' },
        { label: '保持健康', value: 'maintain_health' },
        { label: '康复训练', value: 'rehabilitation' }
    ];

    // 健身水平选项
    const fitnessLevelOptions = [
        { label: '请选择健身水平', value: '' },
        { label: '初学者', value: 'beginner' },
        { label: '中级', value: 'intermediate' },
        { label: '高级', value: 'advanced' }
    ];

    // 预填充已有的用户信息
    useEffect(() => {
        if (isOpen && initialProfile) {
            setFormData({
                full_name: initialProfile.full_name || '',
                nickname: initialProfile.nickname || '',
                phone: initialProfile.phone || '',
                address: initialProfile.address || '',
                gender: initialProfile.gender as any || '',
                birth_date: initialProfile.birth_date ? new Date(initialProfile.birth_date) : null,
                height: initialProfile.height?.toString() || '',
                weight: initialProfile.weight?.toString() || '',
                fitness_goal: initialProfile.fitness_goal || '',
                fitness_level: initialProfile.fitness_level as any || '',
                bio: initialProfile.bio || ''
            });
        }
    }, [isOpen, initialProfile]);


    // 提交个人信息
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nickname.trim()) {
            showToast({ severity: 'error', summary: '错误', detail: '请输入昵称！' });
            return;
        }

        if (!formData.phone.trim()) {
            showToast({ severity: 'error', summary: '错误', detail: '请输入手机号！' });
            return;
        }

        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            showToast({ severity: 'error', summary: '错误', detail: '手机号格式不正确！' });
            return;
        }

        if (!formData.address.trim()) {
            showToast({ severity: 'error', summary: '错误', detail: '请输入详细地址！' });
            return;
        }

        if (formData.address.length < 10) {
            showToast({ severity: 'error', summary: '错误', detail: '地址信息过于简单，请填写详细地址！' });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post('/api/user/update-profile', {
                full_name: formData.full_name || undefined,
                nickname: formData.nickname,
                phone: formData.phone,
                address: formData.address,
                gender: formData.gender || undefined,
                birth_date: formData.birth_date ? formData.birth_date.toISOString().split('T')[0] : undefined,
                height: formData.height ? parseInt(formData.height) : undefined,
                weight: formData.weight ? parseInt(formData.weight) : undefined,
                fitness_goal: formData.fitness_goal || undefined,
                fitness_level: formData.fitness_level || undefined,
                bio: formData.bio || undefined
            });
            
            if (response.data && response.data.success) {
                showToast({ severity: 'success', summary: '成功', detail: '个人信息保存成功！' });

                onComplete(response.data);
            } else {
                showToast({ severity: 'error', summary: '错误', detail: response.data.message })
            }
        } catch (error) {
            console.error('保存个人信息失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存失败，请稍后重试！' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="稍后设置"
                icon="pi pi-times"
                onClick={onClose}
                className="p-button-text"
            />
            <Button
                label="保存信息"
                icon="pi pi-check"
                onClick={handleSubmit as any}
                disabled={isSubmitting}
                loading={isSubmitting}
            />
        </div>
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 遮罩层 - 点击返回上一页 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* 居中容器 + 动画 */}
                    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                        <motion.div
                            onClick={(e) => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="max-w-md md:max-w-2xl lg:max-w-2xl"
                        >
                            <Dialog
                                header="完善个人信息"
                                visible={isOpen}
                                onHide={onClose}
                                footer={footerContent}
                                maximizable
                                className="w-[800px]"
                                breakpoints={{
                                    '960px': 'w-full max-w-xl',
                                    '768px': 'min-w-[90vw]',
                                    '576px': 'min-w-[95vw]'
                                }}
                            >
                                <div className="p-4">
                                    {/* 重要提示 */}
                                    <div className="mb-6 p-4 bg-primary-100 border-round">
                                        <div className="flex align-items-center mb-2">
                                            <i className="pi pi-info-circle mr-2 text-primary-700"></i>
                                            <span className="font-bold text-primary-800">重要提示</span>
                                        </div>
                                        <div className="text-primary-700 text-sm">
                                            <p className="m-0">• <strong>昵称</strong>是您在平台上的主要显示名称，请认真设置</p>
                                            <p className="m-0 mt-1">• 手机号必须与注册时保持一致，用于中奖验证</p>
                                            <p className="m-0 mt-1">• 地址信息将用于实物奖品的快递发送</p>
                                            <p className="m-0 mt-1">• 真实姓名为可选项，仅用于必要的身份验证</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 昵称 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="nickname" className="block text-sm font-medium mb-2">
                                                昵称 <span className="text-red-500">*</span>
                                            </label>
                                            <InputText
                                                id="nickname"
                                                value={formData.nickname}
                                                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                                                placeholder="请输入昵称"
                                                className="w-full"
                                            />
                                        </div>

                                        {/* 真实姓名 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="full_name" className="block text-sm font-medium mb-2">
                                                真实姓名
                                            </label>
                                            <InputText
                                                id="full_name"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                                placeholder="请输入真实姓名（可选）"
                                                className="w-full"
                                            />
                                        </div>

                                        {/* 手机号 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="phone" className="block text-sm font-medium mb-2">
                                                手机号 <span className="text-red-500">*</span>
                                            </label>
                                            <InputText
                                                id="phone"
                                                value={formData.phone}
                                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="请输入手机号"
                                                className="w-full"
                                                keyfilter="int"
                                                maxLength={11}
                                            />
                                        </div>

                                        {/* 生日 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="birth_date" className="block text-sm font-medium mb-2">
                                                生日
                                            </label>
                                            <Calendar
                                                id="birth_date"
                                                value={formData.birth_date}
                                                onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.value as Date | null }))}
                                                placeholder="请选择生日"
                                                className="w-full"
                                                dateFormat="yy-mm-dd"
                                                showIcon
                                            />
                                        </div>

                                        {/* 性别 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="gender" className="block text-sm font-medium mb-2">
                                                性别
                                            </label>
                                            <Dropdown
                                                id="gender"
                                                value={formData.gender}
                                                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.value }))}
                                                options={genderOptions}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* 健身水平 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="fitness_level" className="block text-sm font-medium mb-2">
                                                健身水平
                                            </label>
                                            <Dropdown
                                                id="fitness_level"
                                                value={formData.fitness_level}
                                                onChange={(e) => setFormData(prev => ({ ...prev, fitness_level: e.value }))}
                                                options={fitnessLevelOptions}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* 身高 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="height" className="block text-sm font-medium mb-2">
                                                身高 (cm)
                                            </label>
                                            <InputText
                                                id="height"
                                                value={formData.height}
                                                onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                                                placeholder="请输入身高"
                                                className="w-full"
                                                keyfilter="int"
                                            />
                                        </div>

                                        {/* 体重 */}
                                        <div className="field md:col-span-1">
                                            <label htmlFor="weight" className="block text-sm font-medium mb-2">
                                                体重 (kg)
                                            </label>
                                            <InputText
                                                id="weight"
                                                value={formData.weight}
                                                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                                                placeholder="请输入体重"
                                                className="w-full"
                                                keyfilter="int"
                                            />
                                        </div>

                                        {/* 健身目标 */}
                                        <div className="field md:col-span-2">
                                            <label htmlFor="fitness_goal" className="block text-sm font-medium mb-2">
                                                健身目标
                                            </label>
                                            <Dropdown
                                                id="fitness_goal"
                                                value={formData.fitness_goal}
                                                onChange={(e) => setFormData(prev => ({ ...prev, fitness_goal: e.value }))}
                                                options={fitnessGoalOptions}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* 详细地址 */}
                                        <div className="field md:col-span-2">
                                            <label htmlFor="address" className="block text-sm font-medium mb-2">
                                                详细地址 <span className="text-red-500">*</span>
                                            </label>
                                            <InputTextarea
                                                id="address"
                                                value={formData.address}
                                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                                placeholder="请输入详细地址（省市区街道门牌号）"
                                                className="w-full"
                                                rows={2}
                                            />
                                            <small className="text-gray-500">
                                                {formData.address.length}/200 字符，用于实物奖品快递
                                            </small>
                                        </div>

                                        {/* 个人简介 */}
                                        <div className="field md:col-span-2">
                                            <label htmlFor="bio" className="block text-sm font-medium mb-2">
                                                个人简介
                                            </label>
                                            <InputTextarea
                                                id="bio"
                                                value={formData.bio}
                                                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                                placeholder="简单介绍一下自己的健身经历或目标（可选）"
                                                className="w-full"
                                                rows={3}
                                            />
                                            <small className="text-gray-500">
                                                {formData.bio.length}/200 字符
                                            </small>
                                        </div>
                                    </form>
                                </div>
                            </Dialog>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProfileSetupModal;