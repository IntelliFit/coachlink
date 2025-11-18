'use client'

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';

export default function CoachStudentsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [students, setStudents] = useState<any[]>([]);

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push('/login');
			return;
		}
		(async () => {
			try {
				setLoading(true);
				const resp = await fetch('/api/coach/get-students', { method: 'POST' });
				const data = await resp.json();
				if (resp.ok && data?.success) {
					setStudents(data.data.students || []);
				}
			} finally {
				setLoading(false);
			}
		})();
	}, [status, session, router]);

	if (loading) return <div className="p-6">加载中...</div>;

	return (
		<div className="min-h-screen p-6">
			<h1 className="text-2xl font-semibold mb-4">我的学员</h1>
			<div className="bg-white rounded-xl border">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-gray-500">
							<th className="text-left p-3">昵称</th>
							<th className="text-left p-3">邮箱</th>
							<th className="text-left p-3">订阅档位</th>
							<th className="text-left p-3">操作</th>
						</tr>
					</thead>
					<tbody>
						{students.map((s) => (
							<tr key={s.id} className="border-t">
								<td className="p-3">{s?.profile?.nickname || s?.user?.nickname || '-'}</td>
								<td className="p-3">{s?.user?.email || '-'}</td>
								<td className="p-3">{s?.tier}</td>
								<td className="p-3">
									<Button
										label="查看档案"
										className="p-button-sm"
										onClick={() => router.push(`/dashboard/students/${s.student_id}`)}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}