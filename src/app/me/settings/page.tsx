'use client';

import ChangePasswordForm from '@/components/auth/ChangePasswordForm';
import AccountBindingSection from '@/components/student/profile/AccountBindingSection';
import NotificationSettingsSection from '@/components/settings/NotificationSettingsSection';
import DeleteAccountSection from '@/components/settings/DeleteAccountSection';

export default function StudentSettingsPage() {
    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 mb-2">账号设置</h1>
                    <p className="text-surface-500">管理您的账户安全和偏好设置。</p>
                </div>

                <NotificationSettingsSection />
                <ChangePasswordForm />
                <AccountBindingSection />
                <DeleteAccountSection />
            </div>
        </div>
    );
}
