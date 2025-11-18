'use client'

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import StudentProfilePage from '@/components/student/StudentProfilePage';

export default function StudentProfileRoutePage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();

	const userId = Array.isArray(params?.id) ? params?.id[0] : params?.id;

	if (!userId) return <div className="p-6">缺少学员ID</div>;

	return <StudentProfilePage userId={userId} onBack={() => router.back()} />;
}


