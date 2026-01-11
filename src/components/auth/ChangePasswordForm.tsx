'use client';

import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { userService } from '@/app/service/userService';
import { Lock, Save } from 'lucide-react';

export default function ChangePasswordForm() {
    const { showToast } = useToastContext();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!oldPassword || !newPassword || !confirmPassword) {
            showToast({ severity: 'warn', summary: '请填写完整信息' });
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast({ severity: 'warn', summary: '两次输入的新密码不一致' });
            return;
        }

        if (oldPassword === newPassword) {
            showToast({ severity: 'warn', summary: '新密码不能与旧密码相同' });
            return;
        }

        setLoading(true);
        try {
            await userService.changePassword({
                oldPassword: oldPassword.trim(),
                newPassword: newPassword.trim(),
            });
            showToast({ severity: 'success', summary: '密码修改成功' });
            // 清空表单
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            showToast({ severity: 'error', summary: '修改失败', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface-0 dark:bg-surface-900 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
            <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary-500" />
                修改密码
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
                {/* 旧密码 */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-surface-600 block">当前密码</label>
                    <div className="relative group">
                        <Password
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="输入当前密码"
                            toggleMask
                            feedback={false}
                            pt={{
                                root: { className: 'w-full' },
                                input: {
                                    className: 'w-full p-3 bg-surface-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="h-px bg-surface-100 dark:bg-surface-800 my-4"></div>

                {/* 新密码 */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-surface-600 block">新密码</label>
                    <div className="relative group">
                        <Password
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="设置新密码"
                            toggleMask
                            feedback={true}
                            promptLabel="请输入密码"
                            weakLabel="太弱"
                            mediumLabel="一般"
                            strongLabel="安全"
                            pt={{
                                root: { className: 'w-full' },
                                input: {
                                    className: 'w-full p-3 bg-surface-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 确认新密码 */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-surface-600 block">确认新密码</label>
                    <div className="relative group">
                        <Password
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次输入新密码"
                            toggleMask
                            feedback={false}
                            pt={{
                                root: { className: 'w-full' },
                                input: {
                                    className: 'w-full p-3 bg-surface-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        loading={loading}
                        className="w-full md:w-auto px-8 py-3 bg-primary-500 border-none rounded-xl hover:bg-primary-600 transition-all transform active:scale-[0.98]"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Save size={18} />
                            <span className="font-bold">保存密码修改</span>
                        </div>
                    </Button>
                </div>
            </form>
        </div>
    );
}
