'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { StudentSubscription, GetStudentsResponseDto } from '@/app/api/coach/get-students/entity';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';

export default function StudentsPage() {
    const [students, setStudents] = useState<StudentSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [selectedStudent, setSelectedStudent] = useState<StudentSubscription | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const router = useRouter();
    const { status, data: session } = useSession();

    const loadStudents = async (page: number = 0, limit: number = 10) => {
        try {
            setLoading(true);
            const data = await coachService.getStudents({ page, limit });
            if (data) {
                setStudents(data.students || []);
                setTotalRecords(data.pagination.total);
            }
        } catch (error) {
            console.error('获取学生列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/login');
            return;
        }

        loadStudents(0, rows);
    }, [status, session, router, rows]);

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        const pageIndex = event.page;
        loadStudents(pageIndex, event.rows);
    };

    // 学员信息列模板
    const studentTemplate = (student: StudentSubscription) => {
        return (
            <div className="flex items-center space-x-3">
                <Avatar
                    image={student.profile?.avatar_url || undefined}
                    label={
                        student.profile?.avatar_url
                            ? undefined
                            : student.profile?.nickname?.charAt(0) ||
                            student.profile?.phone?.slice(0, 1) ||
                            'U'
                    }
                    shape="circle"
                    className="bg-primary text-surface font-bold flex-shrink-0"
                    size="normal"
                />
                <div>
                    <div className="font-medium">{student.profile?.nickname}</div>
                    <div className="text-surface-500">{student.profile?.phone}</div>
                </div>
            </div>
        );
    };

    // 注册时间列模板
    const startDateTemplate = (student: StudentSubscription) => {
        return (
            <span className="text-surface-500">
                {new Date(student.start_date || '').toLocaleDateString()}
            </span>
        );
    };

    // 操作列模板
    const actionTemplate = (student: StudentSubscription) => {
        return (
            <Button 
                size="small" 
                icon="pi pi-eye" 
                label="查看详情"
                onClick={() => {
                    setSelectedStudent(student);
                    setDialogVisible(true);
                }}
            />
        );
    };

    // 对话框页脚
    const dialogFooter = (
        <Button 
            label="关闭" 
            icon="pi pi-times" 
            onClick={() => setDialogVisible(false)} 
            className="p-button-text"
        />
    );

    if (loading && students.length === 0) {
        return (
            <div className="p-6">
                <Skeleton width="150px" height="32px" className="mb-6" />
                <div className="bg-surface rounded-xl border">
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
            <div className="bg-surface rounded-xl border">
                <DataTable 
                    value={students} 
                    className="rounded-xl"
                    paginator
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    lazy
                    removableSort
                >
                    <Column 
                        field="student" 
                        header="学员" 
                        body={studentTemplate}
                        sortable
                    />
                    <Column 
                        field="start_date" 
                        header="注册时间" 
                        body={startDateTemplate}
                        sortable
                    />
                    <Column 
                        field="action" 
                        header="操作" 
                        body={actionTemplate}
                    />
                </DataTable>
            </div>

            {/* 学员详情对话框 */}
            <Dialog
                header={selectedStudent ? `学员详情 - ${selectedStudent.profile?.nickname || selectedStudent.user?.email}` : "学员详情"}
                visible={dialogVisible}
                style={{ width: '500px' }}
                onHide={() => setDialogVisible(false)}
                footer={dialogFooter}
            >
                {selectedStudent && (
                    <div className="p-4">
                        <div className="flex items-center mb-6">
                            <Avatar
                                image={selectedStudent.profile?.avatar_url || undefined}
                                label={
                                    selectedStudent.profile?.avatar_url
                                        ? undefined
                                        : selectedStudent.profile?.nickname?.charAt(0) ||
                                        selectedStudent.user?.email.slice(0, 1) ||
                                        'U'
                                }
                                size="xlarge"
                                shape="circle"
                                className="bg-primary text-surface font-bold mr-4"
                            />
                            <div>
                                <div className="text-xl font-semibold">
                                    {selectedStudent.profile?.nickname || '未设置昵称'}
                                </div>
                                <div className="text-surface-500">
                                    {selectedStudent.user?.email}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-surface-500 text-sm mb-1">订阅等级</div>
                                <div className="font-medium">{selectedStudent.tier}</div>
                            </div>
                            <div>
                                <div className="text-surface-500 text-sm mb-1">订阅状态</div>
                                <div className="font-medium capitalize">{selectedStudent.status}</div>
                            </div>
                            <div>
                                <div className="text-surface-500 text-sm mb-1">开始日期</div>
                                <div className="font-medium">
                                    {new Date(selectedStudent.start_date).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-surface-500 text-sm mb-1">健身水平</div>
                                <div className="font-medium">
                                    {selectedStudent.profile?.fitness_level || '未设置'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}