'use client';

import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function StudentSettingsPage() {
    return (
        <div className="min-h-screen bg-surface-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 mb-2">设置</h1>
                    <p className="text-surface-500">管理您的账户安全和偏好设置。</p>
                </div>

                <div className="bg-surface-0 p-6 rounded-2xl shadow-sm border border-surface-200">
                    <h2 className="text-lg font-bold text-surface-900 mb-4">账号安全</h2>
                    <div className="max-w-xl">
                        <ChangePasswordForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
