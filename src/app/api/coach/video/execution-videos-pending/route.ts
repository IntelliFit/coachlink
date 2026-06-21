import { NextResponse } from 'next/server';

import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import type { ApiData } from '@/types/api';
import type { GetExecutionSetVideosDto, GetExecutionSetVideosResponseDto, ExecutionSetVideoWithDetails } from './entity';

/**
 * POST /api/coach/video/execution-videos-pending
 * 获取教练待审阅的execution_set_videos视频列表
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const authResult = session?.user?.id
            ? { isAuthenticated: true, userId: session.user.id }
            : await getAuthUser(req);

        if (!authResult?.isAuthenticated || !authResult.userId) {
            return NextResponse.json({ 
                success: false, 
                message: '未登录用户' 
            }, { status: 401 });
        }

        // 获取教练信息
        const coachUserId = authResult.userId;
        const { data: coachRow, error: coachErr } = await supabase
            .from('coaches')
            .select('id, status')
            .eq('user_id', coachUserId)
            .eq('status', 'approved')
            .maybeSingle();

        if (coachErr || !coachRow) {
            console.error('获取教练信息失败:', coachErr);
            return NextResponse.json({ 
                success: false, 
                message: '未找到教练信息或未审核通过', 
                data: null 
            }, { status: 403 });
        }

        const coachId = coachRow.id;

        const body = await req.json();
        const { pagination, reviewStatus } = body as GetExecutionSetVideosDto;

        // 获取所有订阅该教练的学员 ID
        const { data: subscriptions, error: subsError } = await supabase
            .from('coach_subscriptions')
            .select('student_id')
            .eq('coach_id', coachId)
            .eq('status', 'active');
        
        if (subsError) {
            console.error('获取订阅信息失败:', subsError);
            return NextResponse.json({
                success: false,
                message: '获取订阅信息失败',
                data: null
            }, { status: 500 });
        }
        
        const studentIds = subscriptions?.map(s => s.student_id) || [];

        if (studentIds.length === 0) {
            return NextResponse.json<ApiData<GetExecutionSetVideosResponseDto>>({
                success: true,
                message: '暂无学员',
                data: {
                    videos: [],
                    total: 0
                }
            });
        }

        // 查询 execution_set_videos，关联 plan_instance_executions 获取学员信息
        // 使用类型断言避免 TypeScript 类型推导过深
        let query = supabase
            .from('execution_set_videos')
            .select(`
                *,
                plan_instance_executions!inner(
                    id,
                    student_id,
                    instance_id,
                    day_index,
                    action_executions,
                    started_at,
                    completed_at
                )
            `, { count: 'exact' }) as any;
        
        // 检查 requires_review 字段是否存在，如果不存在则跳过此过滤
        // 注意：如果数据库迁移脚本还未执行，这个字段可能不存在
        try {
            query = query.eq('requires_review', true);
        } catch (e) {
            console.warn('requires_review 字段可能不存在，跳过此过滤');
        }

        // 通过 plan_instance_executions.student_id 过滤学员
        query = query.in('plan_instance_executions.student_id', studentIds);

        // 过滤审阅状态
        const allowedStatuses = ['pending', 'reviewed', 'not_required'] as const;
        if (typeof reviewStatus === 'string' && allowedStatuses.includes(reviewStatus)) {
            try {
                query = query.eq('review_status', reviewStatus);
            } catch (e) {
                console.warn('review_status 字段可能不存在，跳过此过滤');
            }
        }

        // 分页
        if (pagination) {
            const from = (pagination.page - 1) * pagination.limit;
            const to = from + pagination.limit - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query.order('created_at', { ascending: true });

        if (error) {
            console.error('获取教练待审阅视频失败:', error);
            console.error('错误详情:', JSON.stringify(error, null, 2));
            return NextResponse.json({
                success: false,
                message: `获取教练待审阅视频失败: ${error.message || '未知错误'}`,
                data: null
            }, { status: 500 });
        }

    let videos: ExecutionSetVideoWithDetails[] = data || [];

    // 获取学员名称并提取执行详情
    if (videos.length > 0) {
        const uniqueStudentIds = Array.from(
            new Set(videos.map(v => (v as any).plan_instance_executions?.student_id).filter(Boolean))
        ) as string[];

        if (uniqueStudentIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('user_id, full_name, nickname')
                .in('user_id', uniqueStudentIds);

            const nameMap: Record<string, string> = {};
            for (const p of profiles || []) {
                if (p.user_id) {
                    nameMap[p.user_id] = p.nickname || p.full_name || '匿名学员';
                }
            }

            // 处理每个视频，提取执行详情
            videos = videos.map((video, index) => {
                const execution = (video as any).plan_instance_executions;
                const studentId = execution?.student_id;
                const studentName = studentId ? nameMap[studentId] : '匿名学员';
                
                console.log(`\n=== 处理视频 ${index + 1} ===`);
                console.log('视频ID:', video.id);
                console.log('action_id:', video.action_id);
                console.log('set_number:', video.set_number);
                console.log('execution.action_executions 类型:', typeof execution?.action_executions);
                console.log('execution.action_executions 是否是数组:', Array.isArray(execution?.action_executions));
                
                // 从 action_executions JSONB 中提取当前视频对应的动作执行详情
                let executionDetails = undefined;
                
                if (execution?.action_executions) {
                    // 尝试解析 JSONB（可能是字符串或已经是对象）
                    let actionExecutions = execution.action_executions;
                    if (typeof actionExecutions === 'string') {
                        try {
                            actionExecutions = JSON.parse(actionExecutions);
                            console.log('解析 JSONB 字符串成功');
                        } catch (e) {
                            console.error('解析 action_executions 失败:', e);
                        }
                    }
                    
                    if (Array.isArray(actionExecutions)) {
                        console.log('action_executions 数组长度:', actionExecutions.length);
                        console.log('action_executions 内容:', JSON.stringify(actionExecutions, null, 2));
                        
                        const actionExec = actionExecutions.find(
                            (ae: any) => ae.id === video.action_id || ae.action_id === video.action_id
                        );
                        
                        console.log('找到的 actionExec:', actionExec ? '是' : '否');
                        
                        if (actionExec) {
                            console.log('actionExec 内容:', JSON.stringify(actionExec, null, 2));
                            
                            if (actionExec.sets && Array.isArray(actionExec.sets)) {
                                console.log('sets 数组长度:', actionExec.sets.length);
                                
                                const setExec = actionExec.sets.find(
                                    (s: any) => s.set_number === video.set_number || s.setNumber === video.set_number
                                );
                                
                                console.log('找到的 setExec:', setExec ? '是' : '否');
                                
                                if (setExec) {
                                    console.log('setExec 内容:', JSON.stringify(setExec, null, 2));
                                    
                                    executionDetails = {
                                        completed_at: setExec.completed_at || setExec.completedAt || null,
                                        planned_reps: setExec.planned_reps || setExec.plannedReps || setExec.reps,
                                        planned_weight: setExec.planned_weight || setExec.plannedWeight || setExec.weight,
                                        actual_reps: setExec.actual_reps || setExec.actualReps || setExec.completed_reps,
                                        actual_weight: setExec.actual_weight || setExec.actualWeight || setExec.completed_weight,
                                        rpe: setExec.rpe,
                                        rest_seconds: setExec.rest_seconds || setExec.restSeconds
                                    };
                                    
                                    console.log('提取的 executionDetails:', JSON.stringify(executionDetails, null, 2));
                                }
                            } else {
                                console.log('actionExec.sets 不存在或不是数组');
                            }
                        }
                    } else {
                        console.log('action_executions 不是数组');
                    }
                }

                // 移除原始的 plan_instance_executions 数据，使用扁平化的格式
                const { plan_instance_executions, ...videoData } = video as any;

                const result = {
                    ...videoData,
                    student_id: studentId,
                    student_name: studentName,
                    execution_details: executionDetails,
                    metadata: {
                        student_name: studentName,
                        day_index: execution?.day_index,
                        instance_id: execution?.instance_id
                    }
                } as ExecutionSetVideoWithDetails;
                
                console.log('最终返回的视频数据 execution_details:', result.execution_details);
                
                return result;
            });
        }
    }

        return NextResponse.json<ApiData<GetExecutionSetVideosResponseDto>>({
            success: true,
            message: '获取成功',
            data: {
                videos,
                total: count || 0
            }
        });
    } catch (error: any) {
        console.error('API 执行错误:', error);
        return NextResponse.json({
            success: false,
            message: `服务器错误: ${error.message || '未知错误'}`,
            data: null
        }, { status: 500 });
    }
}
