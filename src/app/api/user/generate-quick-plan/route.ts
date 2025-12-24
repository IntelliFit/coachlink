import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { generatePlanByCoachRules, type EnhancedPlanInput } from '@/components/services/planEngine';

export async function POST(request: Request) {
	try {
		const session = await getServerSession();
		if (!session?.user?.id) {
			return NextResponse.json({ success: false, message: '未登录用户', data: null }, { status: 401 });
		}

		const { coachId, domain: domainFromBody } = await request.json();
		if (!coachId) {
			return NextResponse.json({ success: false, message: '缺少教练ID', data: null }, { status: 400 });
		}

		// 读取最近一次问卷答案（用于评估/偏好）
		const { data: questionnaire, error: qErr } = await supabase
			.from('onboarding_questionnaires')
			.select('answers, baseline_video_urls, coach_id, created_at')
			.eq('user_id', session.user.id)
			.eq('coach_id', coachId)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (qErr) {
			// 允许没有问卷也能生成（使用默认值）
			console.warn('读取问卷失败，使用默认参数:', qErr.message);
		}

		const answers: any = questionnaire?.answers || {};
		const domain: string =
			domainFromBody ||
			answers?.domain ||
			answers?.selectedDomain ||
			'weighted_pullup';

		// 组装规则引擎输入
		const input: EnhancedPlanInput = {
			userId: session.user.id,
			coachId,
			goal: 'strength',
			level: (answers.level as any) || 'intermediate',
			focus: 'upper',
			duration_weeks: 6,
			frequency_per_week: Number(answers.weekly_frequency || 3),
			time_per_session: Number(answers.session_duration || 60),
			domain,
			assessment_data: answers,
			weekly_frequency: Number(answers.weekly_frequency || 3),
			session_duration: Number(answers.session_duration || 60),
			available_days: Array.isArray(answers.available_days) ? answers.available_days : [],
			equipment: Array.isArray(answers.equipment) ? answers.equipment : [],
			intensity_preference: answers.intensity_preference || 'balanced',
			rest_policy: answers.rest_policy || 'medium',
			injuries: answers.injuries,
			specific_goal: answers.specific_goal
		};

		// 1) 生成计划结构
		const plan = await generatePlanByCoachRules(input);

	// 2) 插入 training_plans
	const { data: planRow, error: planErr } = await supabase
		.from('training_plans')
		.insert({
			user_id: input.userId,
			coach_id: input.coachId,
			title: plan.meta.title,
			description: `${plan.meta.duration_weeks}周周期化训练计划`,
			difficulty_level: input.level,
			duration_weeks: plan.meta.duration_weeks,
			ai_generated: true,
			enhanced_by_ai: false,
			domain: input.domain,
			assessment_data: input.assessment_data as any,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.select()
		.single();

		if (planErr || !planRow) {
			throw new Error(planErr?.message || '创建训练计划失败');
		}

		// 3) 插入 training_plan_details
		const details = [] as any[];
		plan.weeks.forEach((week: any) => {
			week.sessions.forEach((session: any, idx: number) => {
			details.push({
				training_plan_id: planRow.id,
				week_number: week.week,
				day_of_week: session.day,
				session_focus: session.focus,
				main_exercises: session.main as any,
				accessory_exercises: session.accessories as any,
				warmup: plan.meta.global_warmup as any,
				cooldown: plan.meta.cooldown as any,
				notes: (plan.meta.safety_notes || []).join('\n'),
				order_index: idx
			});
			});
		});

		if (details.length > 0) {
			const { error: detErr } = await supabase.from('training_plan_details').insert(details);
			if (detErr) {
				throw new Error(`保存训练详情失败: ${detErr.message}`);
			}
		}

		return NextResponse.json({
			success: true,
			message: '快速生成计划成功',
			data: { planId: planRow.id }
		});
	} catch (error: any) {
		console.error('generate-quick-plan 错误:', error);
		return NextResponse.json(
			{ success: false, message: error.message || '快速生成失败', data: null },
			{ status: 500 }
		);
	}
}


