
'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import NavigationStudent from './NavigationStudent';
import NavigationCoach from './NavigationCoach';
import NavigationAdmin from './NavigationAdmin';

export default function Navigation() {
    const { data: session, status } = useSession();

    // 在加载中或未登录时，显示学员端导航（默认）
    if (status === 'loading' || !session?.user) {
        return <NavigationStudent />;
    }

    // 根据用户角色显示不同的导航
    if (session?.user?.is_admin) {
        return <NavigationAdmin />;
    } else if (session?.user?.primary_role === 'coach') {
        return <NavigationCoach />;
    } else {
        return <NavigationStudent />;
    }
}
