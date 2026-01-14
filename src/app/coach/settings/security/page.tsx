'use client';

import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function CoachSecuritySettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* 2. 容器：大圆角与呼吸感边框 */}
            <div 
                className="justify-center p-8 rounded-[24px] transition-all duration-500"
            >
                <div className="max-w-xl">
                    <ChangePasswordForm />
                </div>
            </div>
        </div>
    );
}