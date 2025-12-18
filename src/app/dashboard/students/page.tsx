'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { StudentSubscription, GetStudentsResponseDto } from '@/app/api/coach/list-students/entity';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { StudentDetailDialog } from './StudentDetailDialog';
import { CoachReviewDialog } from './CoachReviewDialog';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { CoachesRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';
import { planLibService } from '@/app/service/planLibService';
import type { GetPaymentWaitingStudentsResponseDto } from '@/app/api/coach/get-payment-waiting-students/entity';

interface StudentWithPlan extends StudentSubscription {
    plan?: {
        name: string;
        description: string;
    } | null;
}

export default function StudentsPage() {
    const [students, setStudents] = useState<StudentWithPlan[]>([]);
    const [waitingStudents, setWaitingStudents] = useState<GetPaymentWaitingStudentsResponseDto['subscriptions']>([]);
    const [coach, setCoach] = useState<CoachesRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [selectedStudent, setSelectedStudent] = useState<StudentWithPlan | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [reviewDialogVisible, setReviewDialogVisible] = useState(false);
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    const [pricingMap, setPricingMap] = useState<Record<number, { is_ai_plan: boolean }>>({});

    const router = useRouter();
    const { showToast } = useToastContext();
    const { status, data: session } = useSession();

    const loadPricing = async () => {
        if (!coach) return;
        const res = await coachService.getPricing({ coachId: coach.id });
        if (res && Array.isArray(res.pricings)) {
            const map: Record<number, { is_ai_plan: boolean }> = {};
            res.pricings.forEach((p: any, idx: number) => {
                map[idx + 1] = { is_ai_plan: !!p.is_ai_plan };
            });
            setPricingMap(map);
        }
    };

    const loadWaitingStudents = async () => {
        const res = await coachService.getPaymentWaitingStudents({});
        if (res) {
            setWaitingStudents(res.subscriptions || []);
        }
    }

    /** 加载训练计划并更新到 students */
    const loadTrainingPlan = async (subscriptionId: string) => {
        try {
            const res = await planLibService.getInstance({ subscriptionId });

            if (res) {

                setStudents(prev =>
                    prev.map(s =>
                        s.id === subscriptionId
                            ? {
                                ...s,
                                plan: res.instance
                            }
                            : s
                    )
                );
            }

        } catch (error) {
            console.error('获取训练计划失败:', error);
            setStudents(prev =>
                prev.map(s =>
                    s.id === subscriptionId
                        ? { ...s, plan: null }
                        : s
                )
            );
        }
    };

    /** 加载学生列表 */
    const loadStudents = async (page: number = 0, limit: number = 10) => {
        try {
            setLoading(true);

            const data = await coachService.listStudents({
                pagination: { page, limit }
            });

            if (data) {
                // 初次注入 plan 字段
                const studentsWithPlan = (data.students || []).map(s => ({
                    ...s,
                    plan: undefined,
                }));

                setStudents(studentsWithPlan);
                setTotalRecords(data.pagination.total);

                // 异步加载每个训练计划
                studentsWithPlan.forEach(student => {
                    loadTrainingPlan(student.id);
                });
            }
        } catch (error) {
            console.error('获取学生列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCoach = async () => {
        const res = await coachService.getCoach({ userId: session?.user?.id || '' });
        if (res) setCoach(res.coach);
    };

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/login');
            return;
        }

        loadStudents(0, rows);
        loadCoach();
        loadWaitingStudents();
    }, [status, session, router, rows]);

    useEffect(() => {
        if (coach) {
            loadPricing();
        }
    }, [coach]);

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        loadStudents(event.page, event.rows);
    };

    const makeAiInstance = async (student: StudentWithPlan) => {
        const res = await planLibService.createAiInstance({
            subscriptionId: student.id
        });

        console.log(res);
    }

    /** 学员列 */
    const studentTemplate = (student: StudentWithPlan) => (
        <div
            className="flex items-center space-x-3 cursor-pointer hover:bg-surface-100 p-2 rounded"
            onClick={() => {
                setSelectedStudent(student);
                setDialogVisible(true);
            }}
        >
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
                {pricingMap[student.tier]?.is_ai_plan && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">AI 计划</span>
                )}
            </div>
        </div>
    );

    const subscribeTemplate = (student: StudentWithPlan) => (
        <div className="flex flex-col gap-1 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 text-surface-700 w-fit">
                <i className="pi pi-wallet text-xs" /> 套餐{student.tier} ¥{student.monthly_price}/月
            </span>
            {/* <Button
                label='测试AI计划生成'
                size='small'
                onClick={() => makeAiInstance(student)}
            ></Button> */}
        </div>
    )

    /** 注册时间列 */
    const startDateTemplate = (student: StudentWithPlan) => (
        <span className="text-surface-500">
            {new Date(student.start_date || '').toLocaleDateString()}
        </span>
    );

    /** 视频数量列 */
    const videoStatsTemplate = (student: StudentWithPlan) => {
        const unreviewed = student.uploaded - student.reviewed;
        return (
            <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 font-medium w-fit">
                    <i className="pi pi-video text-xs" />
                    {student.uploaded - unreviewed} / {student.uploaded}
                </span>
            </div>
        );
    };

    /** 训练计划列 */
    const trainingPlanTemplate = (student: StudentWithPlan) => {
        if (student.plan === undefined) {
            return <Skeleton width="100px" height="20px" />;
        }

        if (student.plan === null) {
            return (
                <div
                    className="cursor-pointer hover:text-primary flex items-center text-surface-500 p-3 hover:bg-surface-100 rounded"
                    onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
                >
                    <i className="pi pi-plus-circle mr-2"></i>
                    创建训练计划
                </div>
            );
        }

        return (
            <div
                className="cursor-pointer hover:text-primary flex flex-col items-baseline text-surface-500 p-3 hover:bg-surface-100 rounded"
                onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
            >
                <div className="font-medium">{student.plan.name}</div>
                <div className="text-sm text-surface-500 truncate max-w-xs">
                    {student.plan.description ? (
                        <>
                            {student.plan.description.substring(0, 10)}
                            {student.plan.description.length > 10 ? '...' : ''}
                        </>
                    ) : (
                        <span className="italic">暂无描述</span>
                    )}
                </div>
            </div>
        );
    };

    /** 操作列 */
    const actionTemplate = (student: StudentWithPlan) => (
        <Button
            size="small"
            icon="pi pi-comment"
            text
            label="评价"
            onClick={() => {
                setSelectedStudent(student);
                setReviewDialogVisible(true);
            }}
        />
    );

    if (loading && students.length === 0) {
        return (
            <div className="min-h-screen p-6">
                <Skeleton width="150px" height="32px" className="mb-6" />
                <div className="bg-surface rounded-xl border border-surface-200">
                    <div className="p-4 border-b border-surface-200">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Skeleton width="200px" height="24px" />
                                <Skeleton width="80px" height="20px" borderRadius="6px" />
                            </div>
                            <Skeleton width="120px" height="36px" borderRadius="6px" />
                        </div>
                    </div>
                    {[1, 2, 3, 4, 5].map((item) => (
                        <div key={item} className="p-4 border-b last:border-b-0 border-surface-200">
                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-12 md:col-span-3">
                                    <div className="flex items-center space-x-3">
                                        <Skeleton width="40px" height="40px" borderRadius="50%" />
                                        <div>
                                            <Skeleton width="80px" height="20px" className="mb-1" />
                                            <Skeleton width="60px" height="16px" />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <Skeleton width="100%" height="28px" borderRadius="16px" />
                                </div>
                                <div className="col-span-12 md:col-span-3">
                                    <div className="p-3">
                                        <Skeleton width="120px" height="20px" className="mb-1" />
                                        <Skeleton width="80px" height="16px" />
                                    </div>
                                </div>
                                <div className="col-span-6 md:col-span-1">
                                    <Skeleton width="80px" height="20px" />
                                </div>
                                <div className="col-span-6 md:col-span-2">
                                    <Skeleton width="100%" height="28px" borderRadius="16px" />
                                </div>
                                <div className="col-span-12 md:col-span-1">
                                    <div className="flex justify-end">
                                        <Skeleton width="60px" height="32px" borderRadius="6px" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-semibold">我的学员</h1>
                <Button
                    label='待确认学员支付'
                    onClick={() => setPaymentDialogVisible(true)}
                    className="p-button-primary"
                    badge={waitingStudents.length.toString()}
                />
            </div>

            <div className="bg-surface border border-surface-200">
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
                    <Column field="student" header="学员" body={studentTemplate} sortable />
                    <Column field="subscription" header="订阅" body={subscribeTemplate} />
                    <Column field="trainingPlan" header="训练计划" body={trainingPlanTemplate} />
                    <Column field="start_date" header="订阅时间" body={startDateTemplate} />
                    <Column field="uploaded" header="已评价/视频总数" body={videoStatsTemplate} />
                    <Column field="action" header="操作" body={actionTemplate} />
                </DataTable>
            </div>

            <StudentDetailDialog
                visible={dialogVisible}
                coach={coach}
                student={selectedStudent}
                onHide={() => setDialogVisible(false)}
            />

            <CoachReviewDialog
                visible={reviewDialogVisible}
                coach={coach}
                student={selectedStudent}
                onHide={() => setReviewDialogVisible(false)}
                onSave={() => loadStudents()}
            />

            <PaymentConfirmationDialog
                visible={paymentDialogVisible}
                subscriptions={waitingStudents}
                onHide={() => setPaymentDialogVisible(false)}
                onConfirm={() => {
                    // 重新加载等待支付的学生列表
                    loadWaitingStudents();
                    // 重新加载学生列表以更新状态
                    loadStudents(0, rows);
                }}
            />
        </div>
    );
}