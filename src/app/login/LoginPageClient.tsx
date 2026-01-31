'use client';

import { useEffect } from 'react';
import { useLoginModal } from '@/components/auth/LoginModalContext';

export default function LoginPageClient() {
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    // 当访问 /login 路由时，打开登录模态框
    openLoginModal();
  }, [openLoginModal]);

  return null;
}

