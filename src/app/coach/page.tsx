'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CoachPage() {
    const router = useRouter();

    useEffect(() => {
        // 重定向到默认子路由
        router.replace('/coach/subscription');
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
        </div>
    );
}
