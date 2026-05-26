'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { useOnboardingModal } from '@/components/auth/OnboardingModalContext';
import { userService } from '@/app/service/userService';
import { waitForSessionReady } from '@/lib/auth/sessionSync';

export default function CompleteProfilePage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { openOnboardingModal, clearOnboardingSuppression, isOnboardingModalOpen } = useOnboardingModal();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('正在为你打开资料填写流程...');
    const attemptedUserIdRef = useRef<string | null>(null);
    const attemptedSessionRecoveryRef = useRef(false);

    useEffect(() => {
        if (status === 'loading') {
            return;
        }

        if (!session?.user?.id) {
            if (attemptedSessionRecoveryRef.current) {
                router.replace('/login');
                return;
            }

            attemptedSessionRecoveryRef.current = true;
            setLoading(true);
            setMessage('正在同步登录状态，马上进入资料填写...');

            void waitForSessionReady({ timeoutMs: 3_000 }).then((recoveredSession) => {
                if (recoveredSession?.user?.id) {
                    router.refresh();
                    return;
                }

                router.replace('/login');
            });
            return;
        }

        attemptedSessionRecoveryRef.current = false;

        if (attemptedUserIdRef.current === session.user.id) {
            setLoading(false);
            return;
        }

        attemptedUserIdRef.current = session.user.id;

        const openFlow = async () => {
            setLoading(true);
            clearOnboardingSuppression();

            try {
                const res = await userService.getProfile({});
                const profile = res?.profile;

                if (!profile) {
                    setMessage('未找到资料，正在重试...');
                    openOnboardingModal(null);
                    return;
                }

                const done =
                    profile.onboarding_completed === true &&
                    !!profile.nickname?.trim() &&
                    !!profile.gender &&
                    typeof profile.height === 'number' &&
                    profile.height > 0 &&
                    typeof profile.weight === 'number' &&
                    profile.weight > 0 &&
                    !!profile.fitness_goal &&
                    !!profile.fitness_level;

                if (done) {
                    router.replace('/impromptu-training?from=complete-profile');
                    return;
                }

                openOnboardingModal(profile);
                setMessage('请先完成基础资料，我们会马上带你进入首次训练。');
            } catch {
                setMessage('打开资料填写流程时遇到一点问题，请点击下方按钮继续。');
            } finally {
                setLoading(false);
            }
        };

        void openFlow();
    }, [session?.user?.id, status, router, clearOnboardingSuppression, openOnboardingModal]);

    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-app-canvas">
            <div className="w-full max-w-[520px] rounded-[24px] bg-surface p-8 shadow-xl border border-surface-100 text-center">
                <div className="text-[11px] font-black tracking-[0.24em] text-primary-600 uppercase">
                    Profile Setup
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-surface-900">
                    先把资料补完整
                </h1>
                <p className="mt-3 text-sm leading-6 text-surface-600">{message}</p>

                <div className="mt-8 flex flex-col gap-3">
                    <Button
                        label={loading ? '加载中...' : isOnboardingModalOpen ? '资料填写已打开' : '继续填写资料'}
                        onClick={() => {
                            clearOnboardingSuppression();
                            openOnboardingModal();
                        }}
                        disabled={loading && isOnboardingModalOpen}
                        className="w-full py-3 bg-primary-500 border-none rounded-2xl hover:bg-primary-600"
                    />
                    <Button
                        label="返回发现页"
                        outlined
                        onClick={() => router.push('/coach/discovery')}
                        className="w-full py-3 rounded-2xl"
                    />
                </div>
            </div>
        </main>
    );
}
