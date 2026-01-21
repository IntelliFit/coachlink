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
import { Checkbox } from 'primereact/checkbox';
import { StudentDetailDialog } from './StudentDetailDialog';
import { Tag } from 'primereact/tag';
import { CoachReviewDialog } from './CoachReviewDialog';
import ChatDialog from '@/components/chat/ChatDialog';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { AiInstanceConfigDialog, type AiInstanceConfig } from './AiInstanceConfigDialog';
import { CoachesRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';
import { planLibService } from '@/app/service/planLibService';
import { chatService } from '@/app/service/chatService';
import { subscriptionService } from '@/app/service/subscriptionService';
import type { GetPaymentWaitingStudentsResponseDto } from '@/app/api/coach/get-payment-waiting-students/entity';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import { Calendar, CheckCircle2, ChevronRight, Circle, MessageSquare, MoreVertical, Plus, Sparkles, SparklesIcon, Users, Video } from 'lucide-react';
import { ProgressBar } from 'primereact/progressbar';

export default function StudentsPage() {
    const [students, setStudents] = useState<StudentSubscription[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<StudentSubscription[]>([]);
    // 手机端/桌面端：默认全选“未配置计划”的学员；用户可手动取消勾选（记录在 excludedNoPlanIds）
    const [excludedNoPlanIds, setExcludedNoPlanIds] = useState<string[]>([]);
    const [manualPaymentSubscriptions, setManualPaymentSubscriptions] = useState<GetPaymentWaitingStudentsResponseDto['manualSubscriptions']>([]);
    const [systemPaymentSubscriptions, setSystemPaymentSubscriptions] = useState<GetPaymentWaitingStudentsResponseDto['systemSubscriptions']>([]);
    const [coach, setCoach] = useState<CoachesRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [selectedStudent, setSelectedStudent] = useState<StudentSubscription | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [reviewDialogVisible, setReviewDialogVisible] = useState(false);
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    const [aiConfigDialogVisible, setAiConfigDialogVisible] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [bulkAiConfigDialogVisible, setBulkAiConfigDialogVisible] = useState(false);
    const [bulkAiGenerating, setBulkAiGenerating] = useState(false);
    const [pricingMap, setPricingMap] = useState<Record<number, { is_ai_plan: boolean }>>({});
    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [selectedChatroom, setSelectedChatroom] = useState<ChatroomDetail | null>(null);

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
            setManualPaymentSubscriptions(res.manualSubscriptions || []);
            setSystemPaymentSubscriptions(res.systemSubscriptions || []);
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
                setStudents(data.students);
                setTotalRecords(data.pagination.total);
            }
        } catch (error) {
            console.error('获取学生列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCoach = async () => {
        const res = await coachService.getCoach({ userId: session?.user?.id || '' });
        if (res) {
            setCoach(res.coach);
            // 无论是平台支付还是个人二维码支付，都加载待确认的学员
            loadWaitingStudents();
        }
    };

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/login');
            return;
        }

        loadStudents(0, rows);
        loadCoach();
    }, [status, session, router, rows]);

    useEffect(() => {
        if (coach) {
            loadPricing();
        }
    }, [coach]);

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        setLoading(true);
        setStudents([]);
        setSelectedStudents([]);

        loadStudents(event.page, event.rows);
    };

    // 当前页默认选中“未配置计划”的学员；跨页取消通过 excludedNoPlanIds 生效
    // 注意：这里不要监听 excludedNoPlanIds，否则会在用户点击复选框时立刻“反向覆盖”selection，导致 UI 看起来不变
    useEffect(() => {        
        const noPlan = (students || []).filter(s => s.plan === null);
        const excludeSet = new Set(excludedNoPlanIds || []);
        setSelectedStudents(noPlan.filter(s => !excludeSet.has(s.id)));
    }, [students]);

    /** 打开AI生成配置对话框 */
    const openAiConfigDialog = (student: StudentSubscription) => {
        setSelectedStudent(student);
        setAiConfigDialogVisible(true);
    };

    /** 执行AI生成（带配置参数） */
    const makeAiInstance = async (student: StudentSubscription, config: AiInstanceConfig) => {
        setAiGenerating(true);
        showToast({ severity: 'info', summary: '快速生成中', detail: '正在根据学员问卷自动创建训练计划' });

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
                    const defaultPlanName = `${student.profile?.nickname || '学员'}的计划`;
                    const sanitizedName = res.template.name?.trim();
                    const planName = sanitizedName && !/AI\s*生成计划/.test(sanitizedName)
                        ? sanitizedName
                        : defaultPlanName;

                    setStudents(prev =>
                        prev.map(s =>
                            s.id === student.id
                                ? {
                                    ...s,
                                    plan: {
                                        name: planName,
                                        description: res.template.description || '暂无描述',
                                        status: 'active'
                                    }
                                }
                                : s
                        )
                    );
                } else {
                    showToast({ severity: 'warn', summary: '创建失败', detail: '无法找到匹配的项' });
                }
            } else {
                showToast({ severity: 'error', summary: '创建失败', detail: '无法创建智能实例' });
            }
        } finally {
            setAiGenerating(false);
        }
    }

    /** 批量执行AI生成（失败容错：失败项跳过） */
    const makeAiInstancesBulk = async (_targets: StudentSubscription[], config: AiInstanceConfig) => {
        setBulkAiGenerating(true);
        showToast({
            severity: 'info',
            summary: '批量生成中',
            detail: `正在为所有未配置计划的学员批量快速生成（失败会自动跳过）`,
        });

        try {
            const res = await planLibService.bulkCreateAiInstances({
                mode: 'no_plan',
                excludedSubscriptionIds: excludedNoPlanIds,
                startWeek: config.startWeek,
                startDay: config.startDay,
                keepOriginalIndex: config.keepOriginalIndex,
            });

            const successMap = new Map<string, any>();
            (res?.results || []).forEach((r: any) => {
                if (r?.success) successMap.set(r.subscriptionId, r.template);
            });

            if (successMap.size > 0) {
                setStudents(prev => prev.map(s => {
                    if (!successMap.has(s.id)) return s;
                    const tpl = successMap.get(s.id);
                    return {
                        ...s,
                        plan: {
                            name: tpl?.name || `${s.profile?.nickname || '学员'}的计划`,
                            description: tpl?.description || '暂无描述',
                            status: tpl?.status || 'active',
                        },
                    };
                }));
            }

            const successCount = res?.successCount ?? successMap.size;
            const failedCount = res?.failedCount ?? 0;

            showToast({
                severity: failedCount > 0 ? 'warn' : 'success',
                summary: '批量生成完成',
                detail: failedCount > 0
                    ? `成功 ${successCount}，失败 ${failedCount}（已跳过失败项）`
                    : `成功生成 ${successCount} 个计划`,
            });

            setBulkAiConfigDialogVisible(false);
            // 不清空 excludedNoPlanIds：用户跨页的“取消勾选”应继续生效
        } catch (e: any) {
            showToast({ severity: 'error', summary: '批量生成失败', detail: e?.message || '请稍后重试' });
        } finally {
            setBulkAiGenerating(false);
        }
    };

    /** 获取产品��称 */
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
            <div className={`inline-flex items-center w-[fit-content] gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider ${config.color}`}>
                <i className={`${config.icon} text-[10px]`} />
                {config.label}
            </div>
        );
    };

    /** 学员基本信息列 */
    const studentTemplate = (student: StudentSubscription) => (
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
    const subscribeTemplate = (student: StudentSubscription) => {
        const subscribeData = student.subscribe_data as any;
        let isOffline = false;
        if (Array.isArray(subscribeData)) {
            isOffline = !!subscribeData.find((item: any) => item.type === 'offline_payment');
        } else if (subscribeData?.offline_payment) {
            isOffline = true;
        }

        return (
            <div className="flex flex-col gap-1.5 py-2">
                {productTagTemplate(Number(student.tier))}
                <div className="flex items-center gap-2 text-surface-500">
                    {isOffline ? (
                        <>
                            <Tag value="线下" className="bg-emerald-100 text-emerald-700 border-emerald-200 h-5 text-[10px]" rounded></Tag>
                            <span className="text-xs font-bold tracking-tight text-emerald-700">已支付</span>
                        </>
                    ) : (
                        <>
                            <Calendar size={12} />
                            <span className="text-xs font-bold tracking-tight">
                                {student.subscribed_weeks}周计划
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    /** 视频评价进度列 */
    const videoStatsTemplate = (student: StudentSubscription) => {
        const unreviewed = student.uploaded - student.reviewed;
        const hasUnreviewed = unreviewed > 0;

        return (
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    {/* 已评价数值 */}
                    <div className="flex items-baseline gap-1 bg-surface-50 px-2.5 py-1 rounded-lg border border-surface-100">
                        <span className="text-xs font-black text-surface-900">{student.reviewed}</span>
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-tighter">审阅</span>
                    </div>

                    <span className="text-surface-200 text-xs font-light">/</span>

                    {/* 总数数值 */}
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-surface-500">{student.uploaded}</span>
                        <span className="text-[10px] font-medium text-surface-400">总计</span>
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
    const trainingPlanTemplate = (student: StudentSubscription) => {
        const plan = student.plan;
        const isCompleted = plan?.status === 'completed';
        const isActive = plan && !isCompleted;
        const hasPlan = !!plan; // 是否已有计划

        if (student.plan === undefined) return <Skeleton width="100%" height="48px" borderRadius="12px" />;

        return (
            <div className="w-full">
                {/* 优化后的呼吸感卡片 */}
                <div
                    onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
                    className={`
                    group flex items-center p-3 rounded-xl border transition-all duration-300 cursor-pointer w-full
                    ${isActive
                            ? 'border-primary-100 dark:border-orange-800 bg-surface shadow-sm shadow-primary-50/50 dark:shadow-primary-800/50'
                            : 'border-surface-100 bg-surface-50/20 opacity-80'}
                `}
                >
                    {/* 状态指示区 */}
                    <div className="flex-shrink-0 mr-3">
                        {isActive ? (
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-50/10 text-primary-600">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-600"></span>
                                </span>
                            </div>
                        ) : isCompleted ? (
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600">
                                <CheckCircle2 size={18} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-100 text-surface-400">
                                <Plus size={18} />
                            </div>
                        )}
                    </div>

                    {/* 内容区 */}
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className={`text-sm font-bold truncate ${isActive ? 'text-surface-900' : 'text-surface-600'}`}>
                            {plan?.name || '未配置计划'}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase ${isActive ? 'text-primary-600' : 'text-surface-400'}`}>
                                {isActive ? '进行中' : isCompleted ? '已完成' : '待处理'}
                            </span>
                            {plan?.description && (
                                <>
                                    <span className="text-surface-300 text-[10px]">|</span>
                                    <span className="text-[11px] text-surface-400 truncate font-medium italic">
                                        {plan.description}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 快速生成图标 - 只对已完成和未配置的计划显示 */}
                    {!isActive && (
                        <Button
                            icon={<SparklesIcon size={18} />}
                            className="p-button-rounded p-button-text p-button-secondary ml-1"
                            style={{ width: '2.5rem', height: '2.5rem' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                openAiConfigDialog(student);
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }; const contactStudent = async () => {
        if (!session?.user?.id) {
            return;
        }

        console.log('enter');

        setLoading(true);

        try {
            const res = await chatService.getChatroom({ members: [session.user.id, selectedStudent.student_id] });

            if (res) {
                setSelectedChatroom(null);
                setTimeout(() => {
                    setSelectedChatroom(res.chatroom);
                    setChatDialogVisible(true);
                }, 0);
            } else {
                showToast({ severity: 'error', summary: '创建聊天室出错' });
            }
        } finally {
            setLoading(false);
        }
    }

    const trainingProgressTemplate = (student: StudentSubscription) => {
        const plan = student.plan;

        // 1. 加载中
        if (student.plan === undefined) return <Skeleton width="100%" height="12px" borderRadius="10px" />;

        // 2. 无计划状态
        if (!plan) {
            return (
                <div className="flex flex-col gap-1 px-2">
                    <div className="w-full h-1.5 bg-surface-100 rounded-full" />
                    <span className="text-[10px] font-bold text-surface-300 uppercase tracking-tighter">未开始</span>
                </div>
            );
        }

        // 3. 计算数据 (实际使用请确保从后端获取相应字段)
        const completedDays = student.progress.completed || 0;
        const totalDays = student.progress.total || 0;
        const percentage = totalDays === 0 ? 0 :
            Math.min(Math.round((completedDays / totalDays) * 100), 100);

        const isCompleted = plan.status === 'completed';

        return (
            <div className="flex flex-col gap-2 min-w-[180px] px-2">
                {/* 顶部标签：百分比与天数 */}
                <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isCompleted ? 'text-green-600' : 'text-primary'}`}>
                        {isCompleted ? '完成' : '进行中'}
                    </span>
                    <span className="text-[10px] font-bold text-surface-400">
                        {completedDays} / {totalDays} 训练日
                    </span>
                </div>

                {/* PrimeReact ProgressBar 组件 */}
                <ProgressBar
                    value={isCompleted ? 100 : percentage}
                    showValue={false} // 我们在上方自定义显示数值，所以这里设为 false
                    style={{ height: '8px' }}
                    className={`border-none bg-surface-100 rounded-full overflow-hidden`}
                    // 使用 pt (Pass Through) 属性精准控制内部样式
                    pt={{
                        value: {
                            className: `transition-all duration-1000 ease-in-out ${isCompleted ? 'bg-green-500' : 'bg-primary'}`
                        }
                    }}
                />

                {/* 底部详细数值提示 */}
                <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-black italic ${isCompleted ? 'text-green-600' : 'text-surface-900'}`}>
                        {isCompleted ? 100 : percentage}%
                    </span>
                </div>
            </div>
        );
    };

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
        <div className="min-h-screen p-3 sm:p-4 md:p-8 max-w-[1400px] mx-auto">
            {/* Header: 增强生产力氛围 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-10 px-1 sm:px-2">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-surface-900">
                        学员管理 <span className="text-primary">.</span>
                    </h1>
                    <div className="flex items-center gap-4 text-surface-400 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                            <Users size={16} /> <span>{totalRecords} 位学员</span>
                        </div>
                    </div>
                </div>
                {/* 无论是平台支付还是个人二维码支付，都显示待支付确认按钮 */}
                <div className="flex gap-3 w-full md:w-auto">
                    <Button
                        label="待支付确认"
                        onClick={() => setPaymentDialogVisible(true)}
                        className="p-button-primary w-full md:w-auto shadow-lg shadow-primary-200 dark:shadow-primary-700 transition-transform active:scale-95 rounded-2xl px-5 py-2.5 text-sm"
                        badge={(manualPaymentSubscriptions.length + systemPaymentSubscriptions.length) > 0
                            ? (manualPaymentSubscriptions.length + systemPaymentSubscriptions.length).toString()
                            : undefined}
                        badgeClassName="p-badge-danger"
                    />
                </div>
            </div>

            {/* Mobile: 卡片列表（避免 DataTable 横向溢出导致“只显示一小块”） */}
            <div className={`md:hidden space-y-2 pb-24`}>
                {students.map((student) => {
                    const nick = student.profile?.nickname || '未知学员';
                    const unreviewed = (student.uploaded || 0) - (student.reviewed || 0);
                    const plan = student.plan;
                    const isCompleted = plan?.status === 'completed';
                    const isActive = !!plan && !isCompleted;
                    const isSelected = selectedStudents.some(s => s.id === student.id);
                    const canSelect = student.plan === null;

                    const completedDays = student.progress?.completed || 0;
                    const totalDays = student.progress?.total || 0;
                    const percentage = totalDays === 0 ? 0 : Math.min(Math.round((completedDays / totalDays) * 100), 100);

                    const subscribeData = student.subscribe_data as any;
                    const isOffline = Array.isArray(subscribeData)
                        ? !!subscribeData.find((item: any) => item.type === 'offline_payment')
                        : !!subscribeData?.offline_payment;

                    return (
                        <details
                            key={student.id}
                            className="group w-full bg-surface rounded-2xl border border-surface-100 shadow-sm overflow-hidden"
                        >
                            <summary className="list-none cursor-pointer select-none px-3 py-3 active:bg-surface-50">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* 批量选择（点击不展开） */}
                                    <div
                                        className="shrink-0"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        {canSelect ? (
                                            <Checkbox
                                                inputId={`bulk_select_${student.id}`}
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    const checked = !!e.checked;
                                                    setExcludedNoPlanIds(prev => {
                                                        const set = new Set(prev || []);
                                                        if (!checked) set.add(student.id);
                                                        else set.delete(student.id);
                                                        return Array.from(set);
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-md border border-surface-200 bg-surface-50 opacity-40" />
                                        )}
                                    </div>
                                    <Avatar
                                        image={student.profile?.avatar_url || undefined}
                                        label={!student.profile?.avatar_url ? nick.charAt(0) : undefined}
                                        shape="circle"
                                        className="w-9 h-9 bg-primary-100 text-primary-700 font-bold shrink-0"
                                    />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="font-black text-surface-900 truncate">{nick}</div>
                                            {productTagTemplate(Number(student.tier))}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                            <span className="px-2 py-0.5 rounded-full bg-surface-50 border border-surface-100 text-surface-600 font-bold">
                                                {isOffline ? '线下已付' : `${student.subscribed_weeks}周`}
                                            </span>
                                            <span
                                                className={[
                                                    'px-2 py-0.5 rounded-full border font-bold',
                                                    isActive ? 'bg-primary-50 border-primary-100 text-primary-700' :
                                                    isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                    'bg-surface-50 border-surface-100 text-surface-500'
                                                ].join(' ')}
                                            >
                                                {isActive ? '进行中' : isCompleted ? '已完成' : '未配置'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full border font-bold ${unreviewed > 0 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-surface-50 border-surface-100 text-surface-400'}`}>
                                                待评 {Math.max(0, unreviewed)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* “档案”入口：不展开，直接打开弹窗 */}
                                    <button
                                        type="button"
                                        className="shrink-0 px-2 py-2 rounded-xl border border-surface-100 bg-surface-50 text-surface-600 font-bold text-xs active:scale-[0.98]"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedStudent(student);
                                            setDialogVisible(true);
                                        }}
                                    >
                                        档案
                                    </button>

                                    <ChevronRight className="w-4 h-4 text-surface-300 shrink-0 transition-transform group-open:rotate-90" />
                                </div>
                            </summary>

                            {/* 展开内容 */}
                            <div className="px-3 pb-3 pt-1">
                                <div className="text-[11px] text-surface-400 font-medium mb-2">
                                    ID: {student.id.slice(0, 8).toUpperCase()}
                                </div>

                                {/* 计划卡片（保留入口） */}
                                <div
                                    className={[
                                        'mt-2 flex items-center gap-3 p-3 rounded-2xl border transition-all',
                                        isActive ? 'border-primary-100 bg-surface shadow-sm shadow-primary-50/50' :
                                        'border-surface-100 bg-surface-50/20 opacity-90'
                                    ].join(' ')}
                                    onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
                                >
                                    <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-primary' : isCompleted ? 'bg-emerald-500' : 'bg-surface-300'}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-black text-surface-900 truncate">
                                            {plan?.name || '未配置计划（点我进入）'}
                                        </div>
                                        {plan?.description ? (
                                            <div className="text-[11px] text-surface-500 truncate">
                                                {plan.description}
                                            </div>
                                        ) : null}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-surface-300 shrink-0" />
                                </div>

                                {/* 进度 + 视频统计 */}
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50/40 px-3 py-2">
                                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">训练进度</div>
                                        <div className="mt-1 flex items-baseline justify-between">
                                            <div className="text-sm font-black text-surface-900">{isCompleted ? 100 : percentage}%</div>
                                            <div className="text-[10px] font-bold text-surface-400">{completedDays}/{totalDays || 0} 训练日</div>
                                        </div>
                                        <div className="mt-2">
                                            <ProgressBar
                                                value={isCompleted ? 100 : percentage}
                                                showValue={false}
                                                style={{ height: '6px' }}
                                                className="border-none bg-surface-100 rounded-full overflow-hidden"
                                                pt={{
                                                    value: { className: `${isCompleted ? 'bg-green-500' : 'bg-primary'} transition-all duration-700` }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-surface-100 bg-surface-50/40 px-3 py-2">
                                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">点评/视频</div>
                                        <div className="mt-1 flex items-baseline gap-2">
                                            <div className="text-sm font-black text-surface-900">{student.reviewed || 0}</div>
                                            <div className="text-[10px] font-bold text-surface-400">审阅</div>
                                            <div className="text-surface-200 text-[10px]">/</div>
                                            <div className="text-sm font-black text-surface-900">{student.uploaded || 0}</div>
                                            <div className="text-[10px] font-bold text-surface-400">总计</div>
                                        </div>
                                        <div className="mt-2 text-[10px] font-bold">
                                            {unreviewed > 0 ? (
                                                <span className="text-amber-700">待评 {Math.max(0, unreviewed)}</span>
                                            ) : (
                                                <span className="text-surface-400">全部完成</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 快捷操作 */}
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        label={plan ? '查看计划' : '创建计划'}
                                        icon={plan ? <ChevronRight className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                                        className="p-button-sm w-full rounded-2xl"
                                        onClick={() => router.push(`/dashboard/students/plan/${student.id}`)}
                                    />
                                    {!plan && (
                                        <Button
                                            label="AI生成"
                                            icon={<Sparkles className="w-4 h-4 mr-1" />}
                                            className="p-button-sm p-button-outlined w-[44%] rounded-2xl"
                                            onClick={() => openAiConfigDialog(student)}
                                        />
                                    )}
                                </div>
                            </div>
                        </details>
                    );
                })}

                {/* Mobile 分页：复用 DataTable paginator 太重，这里先用原分页逻辑（保持功能） */}
                <div className="pt-2">
                    <DataTable
                        value={[]}
                        paginator
                        rows={rows}
                        totalRecords={totalRecords}
                        first={first}
                        onPage={onPage}
                        lazy
                        className="bg-transparent"
                    />
                </div>

                {/* Mobile: 批量操作浮动条 */}
                {selectedStudents.length > 0 && (
                    <div className="fixed left-0 right-0 bottom-[88px] z-50 md:hidden">
                        <div className="mx-auto max-w-[1400px] px-3 pb-3">
                            <div className="rounded-2xl border border-surface-100 bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.06)] p-3 flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold text-surface-700">
                                    已选择 <span className="font-black text-primary">{selectedStudents.length}</span> 位学员
                                </div>
                                <Button
                                    label="批量生成"
                                    icon={<Sparkles size={14} />}
                                    className="p-button-sm rounded-xl"
                                    onClick={() => setBulkAiConfigDialogVisible(true)}
                                    disabled={bulkAiGenerating}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop: DataTable */}
            <div className="hidden md:block bg-surface rounded-[32px] border border-surface-100 shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-surface-100 flex items-center justify-between">
                    <div className="text-sm font-semibold text-surface-700">
                        {selectedStudents.length > 0 ? (
                            <span>已选择 <span className="font-black text-primary">{selectedStudents.length}</span> 位未配置计划的学员</span>
                        ) : (
                            <span className="text-surface-400">请选择未配置计划的学员进行批量操作</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            label="批量快速生成"
                            icon={<Sparkles size={14} />}
                            className="p-button-sm rounded-xl"
                            disabled={selectedStudents.length === 0 || bulkAiGenerating}
                            onClick={() => setBulkAiConfigDialogVisible(true)}
                        />
                        <Button
                            label="清除"
                            icon="pi pi-times"
                            className="p-button-sm p-button-text rounded-xl"
                            disabled={selectedStudents.length === 0 || bulkAiGenerating}
                            onClick={() => {
                                // 清除当前页勾选：把当前页所有“未配置计划”的学员都加入排除列表，并清空 selection
                                const noPlanIds = students.filter(s => s.plan === null).map(s => s.id);
                                setExcludedNoPlanIds(prev => Array.from(new Set([...(prev || []), ...noPlanIds])));
                                setSelectedStudents([]);
                            }}
                        />
                    </div>
                </div>
                <DataTable
                    value={students}
                    paginator
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    lazy
                    removableSort
                    breakpoint="960px"
                    className="p-datatable-custom"
                    rowClassName={() => 'hover:bg-primary-50/20 transition-colors border-b border-surface-50 last:border-0'}
                    dataKey="id"
                    selection={selectedStudents}
                    onSelectionChange={(e) => {                                                
                        // 受控选择：和 PrimeReact demo 一致，selection 直接绑定 setSelectedStudents
                        const newSelection = (e.value || []) as StudentSubscription[];
                        setSelectedStudents(newSelection);

                        // 同步更新 excludedNoPlanIds（用于跨页批量生成的排除逻辑；只关心 plan === null 的行）
                        const selectedIds = new Set(newSelection.map(s => s.id));
                        const noPlanIds = students.filter(s => s.plan === null).map(s => s.id);
                        
                        // 计算哪些应该被排除：所有未配置计划的学员中，没有被选中的
                        setExcludedNoPlanIds(prev => {
                            const set = new Set(prev || []);
                            // 先移除当前页所有未配置计划的学员ID
                            noPlanIds.forEach(id => set.delete(id));
                            // 然后添加未被选中的未配置计划学员ID
                            noPlanIds.forEach(id => {
                                if (!selectedIds.has(id)) {
                                    set.add(id);
                                }
                            });
                            return Array.from(set);
                        });
                    }}
                    selectionMode="checkbox"
                    pt={{
                        headerRow: { className: 'bg-surface-50/50' },
                        column: {
                            headerCell: { className: 'bg-transparent text-surface-400 text-[10px] font-black uppercase tracking-[0.2em] py-5 border-none' },
                            bodyCell: { className: 'py-5 border-none' }
                        }
                    }}
                >
                    <Column selectionMode="multiple" headerStyle={{ width: '3.25rem' }} bodyStyle={{ width: '3.25rem' }} />
                    <Column header="学员信息" body={studentTemplate} style={{ width: '20%' }} />
                    <Column header="订阅状态" body={subscribeTemplate} style={{ width: '12%' }} />
                    <Column header="训练计划" body={trainingPlanTemplate} style={{ width: '23%' }} />
                    <Column header="训练进度" body={trainingProgressTemplate} style={{ width: '25%' }} />
                    <Column header="已评价/视频总数" body={videoStatsTemplate} style={{ width: '20%' }} />
                </DataTable>
            </div>

            {/* Dialogs 保持不变 */}
            <StudentDetailDialog
                visible={dialogVisible}
                coach={coach}
                student={selectedStudent}
                onHide={() => setDialogVisible(false)}
                onShowReviewDialog={() => {
                    setReviewDialogVisible(true);
                }}
                onShowChatDialog={contactStudent}
            />
            <CoachReviewDialog visible={reviewDialogVisible} coach={coach} student={selectedStudent} onHide={() => setReviewDialogVisible(false)} onSave={() => loadStudents()} />
            <ChatDialog
                visible={chatDialogVisible}
                onHide={() => setChatDialogVisible(false)}
                chatroom={selectedChatroom}
            />
            <PaymentConfirmationDialog
                visible={paymentDialogVisible}
                manualSubscriptions={manualPaymentSubscriptions}
                systemSubscriptions={systemPaymentSubscriptions}
                coach={coach}
                onHide={() => {
                    setPaymentDialogVisible(false);
                    // 标记所有“只读通知”（包含 平台待支付 / 系统已确认）为已查看，清除右上角 badge
                    if (systemPaymentSubscriptions.length > 0) {
                        const nowIso = new Date().toISOString();
                        Promise.all(
                            systemPaymentSubscriptions.map(s =>
                                subscriptionService.updateSubscription({ id: s.id, coach_seen_at: nowIso } as any),
                            ),
                        ).finally(() => {
                            loadWaitingStudents();
                        });
                    }
                }}
                onConfirm={() => { loadWaitingStudents(); loadStudents(0, rows); }}
            />
            <AiInstanceConfigDialog visible={aiConfigDialogVisible} studentName={selectedStudent?.profile?.nickname} totalWeeks={12} loading={aiGenerating} onHide={() => setAiConfigDialogVisible(false)} onConfirm={(config) => selectedStudent && makeAiInstance(selectedStudent, config)} />
            <AiInstanceConfigDialog
                visible={bulkAiConfigDialogVisible}
                studentName={selectedStudents.length > 0 ? `${selectedStudents.length}位学员` : undefined}
                totalWeeks={12}
                loading={bulkAiGenerating}
                onHide={() => setBulkAiConfigDialogVisible(false)}
                onConfirm={(config) => makeAiInstancesBulk(selectedStudents, config)}
            />
        </div>
    );
}