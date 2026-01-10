'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoginModal } from '@/components/auth/LoginModalContext';

export default function LoginPage() {
    const router = useRouter();
    const { openLoginModal } = useLoginModal();

    console.log('login v1.0');

    useEffect(() => {
        // 当访问 /login 路由时，打开登录模态框
        openLoginModal();
    }, []);

    return null;
}