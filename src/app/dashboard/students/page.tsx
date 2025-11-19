'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { CoachStudentItem } from '@/types/coach';
import { StudentSubscription } from '@/app/api/coach/get-students/entity';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';


export default function StudentsPage() {
    const [students, setStudents] = useState<StudentSubscription[]>([]);
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
                    setStudents(data.students || []);
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
                        <tr className="border-b text-left text-surface-500">
                            <th className="p-4 font-medium">学员</th>
                            <th className="p-4 font-medium">注册时间</th>
                            <th className="p-4 font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student) => (
                            <tr key={student.id} className="border-b hover:bg-surface-50">
                                <td className="p-4">
                                    <div className="flex items-center space-x-3">
                                        <Avatar
                                            image={student.profile?.avatar_url || undefined}
                                            label={
                                                student.profile?.avatar_url
                                                    ? undefined
                                                    : student.profile?.nickname?.charAt(0) ||
                                                    student.user?.email.slice(0, 1) ||
                                                    'U'
                                            }
                                            shape="circle"
                                            className="bg-primary text-white font-bold flex-shrink-0"
                                            size="normal"
                                        />
                                        <div>
                                            <div className="font-medium">{student.profile?.nickname}</div>
                                            <div className="text-surface-500">{student.user?.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-surface-500">
                                    {new Date(student.start_date || '').toLocaleDateString()}
                                </td>
                                <td className="p-4">
                                    <Button size="small" icon="pi pi-eye" label='查看详情'>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}