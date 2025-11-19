'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';

interface Student {
	id: string;
	name: string;
	email: string;
	avatar_url: string;
	created_at: string;
}

export default function StudentsPage() {
	const [students, setStudents] = useState<Student[]>([]);
	const [loading, setLoading] = useState(true);
	const router = useRouter();
	const { status, data: session } = useSession();

	useEffect(() => {
		if (status === 'loading') return;

		if (!session) {
			router.push('/login');
			return;
		}

		(async () => {
			try {
				const data = await coachService.getStudents();
				if (data) {
					setStudents(data.data.students || []);
				}
			} finally {
				setLoading(false);
			}
		})();
	}, [status, session, router]);

	if (loading) {
		return (
			<div className="p-6">
				<Skeleton width="150px" height="32px" className="mb-6" />
				<div className="bg-white rounded-xl border">
					<div className="p-4 border-b">
						<Skeleton width="100%" height="24px" />
					</div>
					{[1, 2, 3].map((item) => (
						<div key={item} className="p-4 border-b last:border-b-0">
							<div className="flex items-center space-x-4">
								<Skeleton width="40px" height="40px" borderRadius="50%" />
								<div className="flex-1">
									<Skeleton width="120px" height="20px" className="mb-2" />
									<Skeleton width="200px" height="16px" />
								</div>
								<Skeleton width="80px" height="32px" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen p-6">
			<h1 className="text-2xl font-semibold mb-4">我的学员</h1>
			<div className="bg-white rounded-xl border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-gray-500">
							<th className="p-4 font-medium">学员</th>
							<th className="p-4 font-medium">注册时间</th>
							<th className="p-4 font-medium">操作</th>
						</tr>
					</thead>
					<tbody>
						{students.map((student) => (
							<tr key={student.id} className="border-b hover:bg-gray-50">
								<td className="p-4">
									<div className="flex items-center space-x-3">
										<img
											src={student.avatar_url || '/default-avatar.png'}
											alt={student.name}
											className="w-10 h-10 rounded-full object-cover"
										/>
										<div>
											<div className="font-medium">{student.name}</div>
											<div className="text-gray-500">{student.email}</div>
										</div>
									</div>
								</td>
								<td className="p-4 text-gray-500">
									{new Date(student.created_at).toLocaleDateString()}
								</td>
								<td className="p-4">
									<button className="text-blue-600 hover:text-blue-700 font-medium">
										查看详情
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}