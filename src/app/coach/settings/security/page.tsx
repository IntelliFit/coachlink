'use client';

import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function CoachSecuritySettingsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-surface-0 p-6 rounded-2xl shadow-sm border border-surface-200">
                <h2 className="text-lg font-bold text-surface-900 mb-4">账号安全</h2>
                <div className="max-w-xl">
                    <p className="text-surface-500 mb-6">建议定期更换密码以保护您的账户安全。</p>
                    <ChangePasswordForm />
                </div>
            </div>
        </div>
    );
}
