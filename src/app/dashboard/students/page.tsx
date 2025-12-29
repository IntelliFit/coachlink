'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { StudentSubscription } from '@/app/api/coach/list-students/entity';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { StudentDetailDialog } from './StudentDetailDialog';
import { CoachReviewDialog } from './CoachReviewDialog';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { AiInstanceConfigDialog, type AiInstanceConfig } from './AiInstanceConfigDialog';
import { CoachesRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';
import { planLibService } from '@/app/service/planLibService';
import type { GetPaymentWaitingStudentsResponseDto } from '@/app/api/coach/get-payment-waiting-students/entity';
import { Calendar, MessageSquare, Plus, Sparkles, Users, Video } from 'lucide-react';

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
    const [aiConfigDialogVisible, setAiConfigDialogVisible] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
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

    /** 打开AI生成配置对话框 */
    const openAiConfigDialog = (student: StudentWithPlan) => {
        setSelectedStudent(student);
        setAiConfigDialogVisible(true);
    };

    /** 执行AI生成（带配置参数） */
    const makeAiInstance = async (student: StudentWithPlan, config: AiInstanceConfig) => {
        setAiGenerating(true);
        showToast({ severity: 'info', summary: 'AI 生成中', detail: '正在根据学员问卷自动创建训练计划' });

        try {
            const res = await planLibService.createAiInstance({
                subscriptionId: student.id,
                startWeek: config.startWeek,
                startDay: config.startDay,
                keepOriginalIndex: config.keepOriginalIndex,
            });

            if (res) {
                if (res.template) {
                    showToast({ severity: 'success', summary: '创建成功', detail: '已创建训练计划' });
                    setAiConfigDialogVisible(false);
                    // 当res.template非空时，更新当前表单
                    setStudents(prev =>
                        prev.map(s =>
                            s.id === student.id
                                ? {
                                    ...s,
                                    plan: {
                                        name: res.template.name || 'AI 生成计划',
                                        description: res.template.description || '暂无描述'
                                    }
                                }
                                : s
                        )
                    );
                } else {
                    showToast({ severity: 'warn', summary: '创建失败', detail: '无法找到匹配的项目' });
                }
            } else {
                showToast({ severity: 'error', summary: '创建失败', detail: '无法创建AI实例' });
            }
        } finally {
            setAiGenerating(false);
        }
    }

    /** 获取产品名称 */
    const getProductName = (tier: number) => {
        switch (tier) {
            case 1: return '特惠版';
            case 2: return '专业指导版';
            case 3: return '全能指导版';
            default: return `套餐${tier}`;
        }
    };

    /** 获取产品颜色 */
    const getProductColor = (tier: number) => {
        switch (tier) {
            case 3: return 'bg-amber-100 text-amber-700'; // 全能指导版 - 金色
            case 2: return 'bg-blue-100 text-blue-700';   // 专业指导版 - 蓝色
            case 1: return 'bg-green-100 text-green-700'; // 特惠版 - 绿色
            default: return 'bg-surface-100 text-surface-700';
        }
    };

    /** 品牌化产品标签 */
    const productTagTemplate = (tier: number) => {
        const configs: Record<number, { label: string, color: string, icon: string }> = {
            3: { label: '全能指导', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: 'pi pi-crown' },
            2: { label: '专业指导', color: 'bg-primary-50 text-primary-600 border-primary-100', icon: 'pi pi-star' },
            1: { label: '特惠版', color: 'bg-green-50 text-green-600 border-green-100', icon: 'pi pi-tag' },
        };
        const config = configs[tier] || { label: `套餐${tier}`, color: 'bg-surface-50 text-surface-600', icon: 'pi pi-box' };

        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider ${config.color}`}>
                <i className={`${config.icon} text-[10px]`} />
                {config.label}
            </div>
        );
    };

    /** 学员基本信息列 */
    const studentTemplate = (student: StudentWithPlan) => (
        <div
            className="group flex items-center gap-4 py-2 cursor-pointer"
            onClick={() => { setSelectedStudent(student); setDialogVisible(true); }}
        >
            <div className="relative">
                <Avatar
                    image={student.profile?.avatar_url || undefined}
                    label={!student.profile?.avatar_url ? student.profile?.nickname?.charAt(0) : undefined}
                    shape="circle"
                    size="large"
                    className="shadow-sm border-2 border-surface bg-primary-100 text-primary-700 font-bold"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-surface rounded-full" />
            </div>
            <div className="flex flex-col">
                <span className="text-surface-900 font-bold tracking-tight group-hover:text-primary transition-colors">
                    {student.profile?.nickname || '未知学员'}
                </span>
                <span className="text-xs text-surface-400 font-medium tracking-tighter uppercase">
                    ID: {student.id.slice(0, 8)}
                </span>
            </div>
        </div>
    );

    /** 订阅详情列 */
    const subscribeTemplate = (student: StudentWithPlan) => (
        <div className="flex flex-col gap-1.5 py-2">
            {productTagTemplate(Number(student.tier))}
            <div className="flex items-center gap-2 text-surface-500">
                <Calendar size={12} />
                <span className="text-xs font-bold tracking-tight">
                    {student.subscribed_weeks}周计划
                </span>
            </div>
        </div>
    );

    /** 视频评价进度列 */
    const videoStatsTemplate = (student: StudentWithPlan) => {
        const unreviewed = student.uploaded - student.reviewed;
        const hasUnreviewed = unreviewed > 0;

        return (
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    {/* 已评价数值 */}
                    <div className="flex items-baseline gap-1 bg-surface-50 px-2.5 py-1 rounded-lg border border-surface-100">
                        <span className="text-xs font-black text-surface-900">{student.reviewed}</span>
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">Reviewed</span>
                    </div>

                    <span className="text-surface-200 text-xs font-light">/</span>

                    {/* 总数数值 */}
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-surface-500">{student.uploaded}</span>
                        <span className="text-[10px] font-medium text-surface-400">Total</span>
                    </div>
                </div>

                {/* 待处理状态提醒 */}
                {hasUnreviewed ? (
                    <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-wider animate-pulse px-1">
                        <div className="w-1 h-1 bg-primary rounded-full" />
                        {unreviewed} 待评价
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-surface-300 uppercase tracking-wider px-1">
                        <i className="pi pi-check-circle text-[9px]" />
                        全部完成
                    </div>
                )}
            </div>
        );
    };
    /** 训练计划列 - 增加 AI 按钮的视觉吸引力 */
    const trainingPlanTemplate = (student: StudentWithPlan) => {
        if (student.plan === undefined) return <Skeleton width="120px" height="32px" borderRadius="12px" />;

        if (student.plan === null) {
            return (
                <div className='flex items-center gap-2'>
                    <button
                        onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
                        className="flex items-center gap-2 px-3 py-2 bg-surface-50 hover:bg-surface-100 text-surface-600 rounded-xl transition-all active:scale-95 border border-surface-100"
                    >
                        <Plus size={14} />
                        <span className="text-xs font-bold uppercase tracking-tight">手动创建</span>
                    </button>
                    <button
                        onClick={() => openAiConfigDialog(student)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl transition-all active:scale-95 border border-primary-100"
                    >
                        <Sparkles size={14} className="animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-tight">AI 生成</span>
                    </button>
                </div>
            );
        }

        return (
            <div
                className="group flex flex-col p-3 bg-surface-50/50 hover:bg-surface hover:shadow-lg hover:shadow-surface-200/50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-primary-100 max-w-[200px]"
                onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
            >
                <span className="text-sm font-bold text-surface-900 truncate tracking-tight">{student.plan.name}</span>
                <span className="text-[10px] text-surface-400 line-clamp-1 italic font-medium">
                    {student.plan.description || '无详细描述'}
                </span>
            </div>
        );
    };

    /** 注册时间列 */
    const startDateTemplate = (student: StudentWithPlan) => (
        <span className="text-surface-500">
            {new Date(student.start_date || '').toLocaleDateString()}
        </span>
    );

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
        <div className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
            {/* Header: 增强生产力氛围 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 px-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter text-surface-900">
                        学员管理 <span className="text-primary">.</span>
                    </h1>
                    <div className="flex items-center gap-4 text-surface-400 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                            <Users size={16} /> <span>{totalRecords} 位学员</span>
                        </div>
                    </div>
                </div>
                {/* <div className="flex gap-3">
                    <Button
                        label="待支付确认"
                        onClick={() => setPaymentDialogVisible(true)}
                        className="p-button-outlined p-button-secondary rounded-2xl font-bold px-5"
                        badge={waitingStudents.length > 0 ? waitingStudents.length.toString() : undefined}
                        badgeClassName="p-badge-danger"
                    />
                </div> */}
            </div>

            {/* Main Content: 去线条化的 DataView */}
            <div className="bg-surface rounded-[32px] border border-surface-100 shadow-sm overflow-hidden">
                <DataTable
                    value={students}
                    paginator
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    lazy
                    removableSort
                    responsiveLayout="stack"
                    breakpoint="960px"
                    className="p-datatable-custom"
                    rowClassName={() => 'hover:bg-primary-50/20 transition-colors border-b border-surface-50 last:border-0'}
                    pt={{
                        headerRow: { className: 'bg-surface-50/50' },
                        column: {
                            headerCell: { className: 'bg-transparent text-surface-400 text-[10px] font-black uppercase tracking-[0.2em] py-5 border-none' },
                            bodyCell: { className: 'py-5 border-none' }
                        }
                    }}
                >
                    <Column header="学员信息" body={studentTemplate} style={{ width: '25%' }} />
                    <Column header="订阅状态" body={subscribeTemplate} style={{ width: '15%' }} />
                    <Column header="训练计划" body={trainingPlanTemplate} style={{ width: '25%' }} />
                    <Column header="已评价/视频总数" body={videoStatsTemplate} style={{ width: '20%' }} />
                    <Column
                        header="操作"
                        body={(s) => (
                            <div className="flex gap-2">
                                <Button
                                    size="small"
                                    icon={<MessageSquare size={16} className="mr-2" />}
                                    label="评价"
                                    className="p-button-text p-button-primary font-black text-xs uppercase tracking-wider rounded-xl hover:bg-primary-50 transition-all active:scale-95"
                                    onClick={() => { setSelectedStudent(s); setReviewDialogVisible(true); }}
                                />
                                <Button
                                    size="small"
                                    icon={<MessageSquare size={16} className="mr-2" />}
                                    label="交流"
                                    className="p-button-text p-button-primary font-black text-xs uppercase tracking-wider rounded-xl hover:bg-primary-50 transition-all active:scale-95"
                                    onClick={() => { setSelectedStudent(s); setReviewDialogVisible(true); }}
                                />
                            </div>
                        )}
                        style={{ width: '15%', textAlign: 'right' }}
                    />
                </DataTable>
            </div>

            {/* Dialogs 保持不变 */}
            <StudentDetailDialog visible={dialogVisible} coach={coach} student={selectedStudent} onHide={() => setDialogVisible(false)} />
            <CoachReviewDialog visible={reviewDialogVisible} coach={coach} student={selectedStudent} onHide={() => setReviewDialogVisible(false)} onSave={() => loadStudents()} />
            <PaymentConfirmationDialog visible={paymentDialogVisible} subscriptions={waitingStudents} onHide={() => setPaymentDialogVisible(false)} onConfirm={() => { loadWaitingStudents(); loadStudents(0, rows); }} />
            <AiInstanceConfigDialog visible={aiConfigDialogVisible} studentName={selectedStudent?.profile?.nickname} totalWeeks={12} loading={aiGenerating} onHide={() => setAiConfigDialogVisible(false)} onConfirm={(config) => selectedStudent && makeAiInstance(selectedStudent, config)} />
        </div>
    );
}