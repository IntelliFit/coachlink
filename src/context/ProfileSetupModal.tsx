import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { useToastContext } from './ToastContext';
import { userService } from '@/app/service/userService';
import { useSession } from 'next-auth/react';
import type { UpdateProfileResponseDto } from '@/app/api/user/update-profile/entity';

interface ProfileSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (profile: UpdateProfileResponseDto) => void;
    initialProfile?: Partial<UpdateProfileResponseDto>;
    userId?: string;
}

// 只保留账号相关字段，训练相关字段在"我的档案"页面编辑
interface ProfileFormData {
    nickname: string;
    full_name: string;
    phone: string;
    address: string;
    bio: string;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onClose, onComplete, initialProfile, userId }) => {
    const { data: session } = useSession();
    const [formData, setFormData] = useState<ProfileFormData>({
        nickname: '',
        full_name: '',
        phone: '',
        address: '',
        bio: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const { showToast } = useToastContext();

    // 预填充已有的用户信息
    useEffect(() => {
        if (isOpen) {
            setFormData({
                nickname: initialProfile?.nickname || '',
                full_name: initialProfile?.full_name || '',
                phone: session?.user?.phone || initialProfile?.phone || '',
                address: initialProfile?.address || '',
                bio: initialProfile?.bio || ''
            });

            const timer = setTimeout(() => {
                document.querySelectorAll('.p-dialog-content').forEach(el => {
                    el.setAttribute('data-lenis-prevent', '');
                });
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [isOpen, initialProfile, session]);

    // 提交个人信息
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nickname.trim()) {
            showToast({ severity: 'error', summary: '错误', detail: '请输入昵称！' });
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await userService.updateProfile({
                nickname: formData.nickname,
                full_name: formData.full_name || null,
                phone: formData.phone,
                address: formData.address || null,
                bio: formData.bio || null
            });

            if (res) {
                setTimeout(() => {
                    showToast({ severity: 'success', summary: '成功', detail: '账号信息保存成功！' });
                }, 200);

                onComplete(res);
            } else {
                setTimeout(() => {
                    showToast({ severity: 'error', summary: '发生错误，无法更新账号信息' })
                }, 200);
            }
        } catch (error) {
            console.error('保存账号信息失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存失败，请稍后重试！' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onClose}
                className="p-button-text"
            />
            <Button
                label="保存"
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
                            className="max-w-md md:max-w-lg"
                        >
                            <Dialog
                                header="账号设置"
                                visible={isOpen}
                                onHide={onClose}
                                footer={footerContent}
                                className="w-[500px]"
                                breakpoints={{
                                    '768px': 'min-w-[90vw]',
                                    '576px': 'min-w-[95vw]'
                                }}
                            >
                                <div className="p-4">
                                    {/* 提示信息 */}
                                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-center mb-2">
                                            <i className="pi pi-info-circle mr-2 text-blue-600"></i>
                                            <span className="font-semibold text-blue-800">说明</span>
                                        </div>
                                        <div className="text-blue-700 text-sm space-y-1">
                                            <p className="m-0">这里的信息用于账号管理和奖品发放。</p>
                                            <p className="m-0">训练相关信息（身高、体重、健身目标等）请在<strong>「我的档案」</strong>页面编辑。</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* 昵称 */}
                                        <div className="field">
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
                                            <small className="text-gray-400 text-xs mt-1 block">您在平台上的显示名称</small>
                                        </div>

                                        {/* 真实姓名 */}
                                        <div className="field">
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
                                            <small className="text-gray-400 text-xs mt-1 block">仅用于奖品发放时的身份验证</small>
                                        </div>

                                        {/* 手机号 */}
                                        <div className="field">
                                            <label htmlFor="phone" className="block text-sm font-medium mb-2">
                                                手机号
                                            </label>
                                            <InputText
                                                id="phone"
                                                value={formData.phone}
                                                disabled
                                                className="w-full"
                                            />
                                            <small className="text-gray-400 text-xs mt-1 block">注册时的手机号，不可修改</small>
                                        </div>

                                        {/* 详细地址 */}
                                        <div className="field">
                                            <label htmlFor="address" className="block text-sm font-medium mb-2">
                                                收货地址
                                            </label>
                                            <InputTextarea
                                                id="address"
                                                value={formData.address}
                                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                                placeholder="请输入详细地址（省市区街道门牌号）"
                                                className="w-full"
                                                rows={2}
                                            />
                                            <small className="text-gray-400 text-xs mt-1 block">
                                                用于实物奖品快递 ({formData.address.length}/200)
                                            </small>
                                        </div>

                                        {/* 个人简介 */}
                                        <div className="field">
                                            <label htmlFor="bio" className="block text-sm font-medium mb-2">
                                                个人简介
                                            </label>
                                            <InputTextarea
                                                id="bio"
                                                value={formData.bio}
                                                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                                placeholder="简单介绍一下自己（可选）"
                                                className="w-full"
                                                rows={3}
                                            />
                                            <small className="text-gray-400 text-xs mt-1 block">
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