import supabase from '@/lib/supabaseClient';

export interface PlanInput {
	userId: string;
	coachId: string;
	goal: 'strength' | 'endurance' | 'muscle' | 'weight_loss' | 'flexibility' | 'overall';
	level: 'beginner' | 'intermediate' | 'advanced';
	focus: 'upper' | 'lower' | 'core' | 'full_body' | 'cardio';
	duration_weeks: number;
	frequency_per_week: number;
	time_per_session: number;
	injuries?: string;
	specific_goals?: string;
}

export interface EngineExercise {
	name: string;
	sets: number;
	reps: string;
	load_type?: '%1RM' | 'bodyweight' | 'assisted' | 'absolute_kg';
	load_value?: number;
	tempo?: string;
	pause?: string;
	rest_sec?: number;
	notes?: string;
}

export interface EngineSession {
	day: string;
	focus: string;
	main: EngineExercise[];
	accessories: EngineExercise[];
}

export interface EngineWeek {
	week: number;
	sessions: EngineSession[];
}

export interface EnginePlan {
	meta: {
		title: string;
		duration_weeks: number;
		frequency_per_week: number;
		goal: string;
		experience_level: string;
		global_warmup: EngineExercise[];
		cooldown: { name: string; duration_min: number }[];
		safety_notes: string[];
	};
	weeks: EngineWeek[];
}

interface AssessmentData {
	bw_max_reps?: number;
	est_1rm?: number;
	est_3rm?: number;
	can_scapular_initiate?: boolean;
	can_pause_top?: boolean;
	can_pause_bottom?: boolean;
	grip_preference?: string;
	elbow_issues?: boolean;
	shoulder_mobility?: string;
	pullup_bw_max?: number;
	dips_bw_max?: number;
	pullup_1rm?: number;
	dips_1rm?: number;
	priority?: string;
}

export interface EnhancedPlanInput extends PlanInput {
	domain: string;
	assessment_data: AssessmentData;
	weekly_frequency: number;
	session_duration: number;
	available_days: string[];
	equipment: string[];
	intensity_preference: string;
	rest_policy: string;
	injuries?: string;
	specific_goal?: string;
}

type RulepackGenerator = (input: EnhancedPlanInput) => EnginePlan;
const registry: Record<string, RulepackGenerator> = {};

function calculateStartingLoad(
	assessment: AssessmentData,
	domain: string
): { load: number; type: '%1RM' | 'bodyweight' } {
	try {
		if (domain === 'weighted_pullup') {
			if (assessment.est_1rm) {
				return { load: Math.round(assessment.est_1rm * 0.7), type: '%1RM' };
			}
			if (assessment.bw_max_reps) {
				const est1RM =
					assessment.bw_max_reps > 1
						? Math.round(
								(assessment.bw_max_reps * 0.33 * 25) /
									(1.0278 - 0.0278 * assessment.bw_max_reps)
						  )
						: 2.5;
				return { load: Math.round(est1RM * 0.7), type: '%1RM' };
			}
		} else if (domain === 'weighted_dips') {
			if (assessment.est_1rm) {
				return { load: Math.round(assessment.est_1rm * 0.65), type: '%1RM' };
			}
			if (assessment.bw_max_reps) {
				const est1RM =
					assessment.bw_max_reps > 1
						? Math.round(
								(assessment.bw_max_reps * 0.33 * 25) /
									(1.0278 - 0.0278 * assessment.bw_max_reps)
						  )
						: 5;
				return { load: Math.round(est1RM * 0.65), type: '%1RM' };
			}
		}
		return { load: 70, type: '%1RM' };
	} catch (error) {
		console.error('计算起始重量失败:', error);
		return { load: 70, type: '%1RM' };
	}
}

// ---------------- Weighted Pullup 6w ----------------
registry['weighted_pullup_6w'] = function generateWeightedPullup(
	input: EnhancedPlanInput
): EnginePlan {
	try {
		const title = '负重引体 6 周周期计划';
		const warmup: EngineExercise[] = [
			{ name: '弹力带宽拉', sets: 2, reps: '15-20' },
			{ name: '木棍绕肩', sets: 2, reps: '10-12' },
			{ name: '弹力带TWY', sets: 2, reps: '8-10' }
		];
		const cooldown = [{ name: '肩袖松解', duration_min: 5 }];
		const notes = ['组间休息≥240秒，时间不够可主/辅项拆分到两次训练', '训练后冰敷或松解，避免过度拉伸'];

		const weeks: EngineWeek[] = [];
		const normalizedDays = (input.available_days || []).map((d) => {
			const map: Record<string, string> = {
				周一: 'Mon',
				周二: 'Tue',
				周三: 'Wed',
				周四: 'Thu',
				周五: 'Fri',
				周六: 'Sat',
				周日: 'Sun',
				Mon: 'Mon',
				Tue: 'Tue',
				Wed: 'Wed',
				Thu: 'Thu',
				Fri: 'Fri',
				Sat: 'Sat',
				Sun: 'Sun'
			};
			return map[d] || d;
		});
		const baseDays =
			normalizedDays.length >= input.weekly_frequency
				? normalizedDays.slice(0, input.weekly_frequency)
				: normalizedDays.length > 0
				? [...normalizedDays, ...['Mon', 'Wed', 'Fri', 'Tue', 'Thu', 'Sat', 'Sun']].slice(
						0,
						input.weekly_frequency
				  )
				: ['Tue', 'Thu', 'Sat'].slice(0, input.weekly_frequency);

		const mk = (
			name: string,
			sets: number,
			reps: string,
			rest_sec = 240,
			extra?: Partial<EngineExercise>
		): EngineExercise => ({
			name,
			sets,
			reps,
			rest_sec,
			...extra
		});

		for (let w = 1; w <= input.duration_weeks; w++) {
			const sessions: EngineSession[] = [];

			const mainProgress = [
				{ sets: 5, reps: '5' },
				{ sets: 10, reps: '4' },
				{ sets: 7, reps: '5' },
				{ sets: 6, reps: '6' }
			];
			const accProgress = [
				{ sets: 5, reps: '5' },
				{ sets: 6, reps: '6' },
				{ sets: 15, reps: '4' },
				{ sets: 10, reps: '5' }
			];

			const day1: EngineSession = {
				day: baseDays[0] || 'Tue',
				focus: '主项强度',
				main: [],
				accessories: []
			};

			if (w <= 4) {
				const mp = mainProgress[(w - 1) % mainProgress.length];
				const ap = accProgress[(w - 1) % accProgress.length];
				day1.main = [
					mk('负重引体', mp.sets, mp.reps, 240, {
						load_type: '%1RM',
						load_value: 70,
						tempo: '2-1-1',
						notes: '高质量动作'
					}),
					mk('负重引体(顶部暂停)', ap.sets, ap.reps, 240, {
						load_type: '%1RM',
						load_value: 60,
						pause: 'top 2s'
					})
				];
				day1.accessories = [
					mk('肩胛启动悬垂', ap.sets, ap.reps, 180, { load_type: 'assisted', notes: '不完全垂直' }),
					mk('锤式弯举', 3, '10-12', 90)
				];
			}

			const day2: EngineSession = {
				day: baseDays[1] || 'Thu',
				focus: '变式强度',
				main: [],
				accessories: []
			};
			if (w <= 4) {
				const mp = mainProgress[(w - 1) % mainProgress.length];
				const ap = accProgress[(w - 1) % accProgress.length];
				day2.main = [mk('反握/对握引体(主项)', mp.sets, mp.reps, 240, { load_type: '%1RM', load_value: 70 })];
				day2.accessories = [
					mk('速度引体', ap.sets, ap.reps, 180),
					mk('宽距引体', ap.sets > 10 ? 4 : ap.sets, ap.reps === '4' ? '6-8' : ap.reps, 180)
				];
			}

			const day3: EngineSession = {
				day: baseDays[2] || 'Sat',
				focus: '容量/技术',
				main: [mk('自重引体', 4, '接近力竭', 180), mk('顶部暂停维持(0.9极限)', 3, '力竭', 180), mk('上/下半程(0.8极限)', 2, '7/3 或 5/5', 150)],
				accessories: [mk('锤式弯举', 3, '10-12', 90)]
			};

			if (w === 5) {
				day1.main = [mk('负重引体(主项+5kg)', 5, '5', 240, { load_type: '%1RM', load_value: 75 })];
				day1.accessories = [mk('顶/底暂停', 3, '3', 240)];
				day2.main = [mk('反握/对握引体(主项+5kg)', 5, '5', 240, { load_type: '%1RM', load_value: 75 })];
				day2.accessories = [mk('速度引体', 6, '3-5', 180), mk('宽距引体', 4, '6-8', 180)];
				day3.accessories = [mk('锤式弯举', 4, '10-6', 120)];
			}
			if (w === 6) {
				day1.main = [mk('负重引体(主项)', 10, '4', 240, { load_type: '%1RM', load_value: 75 })];
				day1.accessories = [mk('顶/底暂停', 5, '3', 240)];
				day2.main = [mk('反握/对握引体(主项)', 10, '4', 240, { load_type: '%1RM', load_value: 75 })];
				day2.accessories = [mk('速度引体', 6, '3-5', 180), mk('宽距引体', 4, '6-8', 180)];
				day3.accessories = [mk('锤式弯举(+5kg)', 5, '5', 120)];
			}

			sessions.push(day1, day2, day3);
			if (input.frequency_per_week === 4) {
				const day4: EngineSession = {
					day: 'Sat',
					focus: '技术/恢复',
					main: [mk('弹力带宽拉', 3, '20', 60), mk('木棍绕肩', 3, '12', 60)],
					accessories: [mk('胸椎活动/肩袖稳定', 3, '10-15', 60)]
				};
				sessions.push(day4);
			}
			weeks.push({ week: w, sessions });
		}

		return {
			meta: {
				title,
				duration_weeks: 6,
				frequency_per_week: input.weekly_frequency,
				goal: input.goal,
				experience_level: input.level,
				global_warmup: warmup,
				cooldown,
				safety_notes: notes
			},
			weeks
		};
	} catch (error) {
		console.error('生成负重引体计划失败:', error);
		throw new Error('生成训练计划时发生错误');
	}
};

// ---------------- Weighted Dips 6w ----------------
registry['weighted_dips_6w'] = function generateWeightedDips(input: EnhancedPlanInput): EnginePlan {
	const title = '负重臂屈伸 6 周周期计划';
	const warmup: EngineExercise[] = [
		{ name: '肩袖激活', sets: 2, reps: '15-20' },
		{ name: '胸肩伸展', sets: 2, reps: '10-12' },
		{ name: '手腕活动', sets: 2, reps: '10-15' }
	];
	const cooldown = [{ name: '胸肩拉伸', duration_min: 5 }];
	const notes = ['组间休息≥180秒，注意肩关节感受', '如出现肩部不适，立即停止并调整动作'];

	const weeks: EngineWeek[] = [];
	const normalizedDays = (input.available_days || []).map((d) => {
		const map: Record<string, string> = {
			周一: 'Mon',
			周二: 'Tue',
			周三: 'Wed',
			周四: 'Thu',
			周五: 'Fri',
			周六: 'Sat',
			周日: 'Sun',
			Mon: 'Mon',
			Tue: 'Tue',
			Wed: 'Wed',
			Thu: 'Thu',
			Fri: 'Fri',
			Sat: 'Sat',
			Sun: 'Sun'
		};
		return map[d] || d;
	});
	const baseDays =
		normalizedDays.length >= input.weekly_frequency
			? normalizedDays.slice(0, input.weekly_frequency)
			: normalizedDays.length > 0
			? [...normalizedDays, ...['Mon', 'Wed', 'Fri', 'Tue', 'Thu', 'Sat', 'Sun']].slice(
					0,
					input.weekly_frequency
			  )
			: ['Tue', 'Thu', 'Sat'].slice(0, input.weekly_frequency);

	const startingLoad = calculateStartingLoad(input.assessment_data, 'weighted_dips');
	const mk = (
		name: string,
		sets: number,
		reps: string,
		rest_sec = 180,
		extra?: Partial<EngineExercise>
	): EngineExercise => ({
		name,
		sets,
		reps,
		rest_sec,
		...extra
	});

	for (let w = 1; w <= 6; w++) {
		const sessions: EngineSession[] = [];
		const intensityProgression = [65, 70, 75, 80, 75, 80];
		const volumeProgression = [
			{ sets: 5, reps: '5' },
			{ sets: 6, reps: '4' },
			{ sets: 5, reps: '5' },
			{ sets: 4, reps: '6' },
			{ sets: 6, reps: '5' },
			{ sets: 5, reps: '4' }
		];
		const currentIntensity = intensityProgression[w - 1];
		const currentVolume = volumeProgression[w - 1];

		const day1: EngineSession = {
			day: baseDays[0] || 'Tue',
			focus: '主项强度',
			main: [
				mk('负重臂屈伸', currentVolume.sets, currentVolume.reps, 180, {
					load_type: startingLoad.type,
					load_value: Math.round((startingLoad.load * currentIntensity) / 70),
					notes: '控制下降，爆发上升'
				})
			],
			accessories: [mk('钻石俯卧撑', 3, '8-12', 90), mk('绳索下压', 3, '12-15', 60)]
		};

		const day2: EngineSession = {
			day: baseDays[1] || 'Thu',
			focus: '变式容量',
			main: [mk('自重臂屈伸', 4, '接近力竭', 150)],
			accessories: [mk('窄距俯卧撑', 4, '10-15', 90), mk('三头肌伸展', 3, '12-15', 60)]
		};

		const day3: EngineSession = {
			day: baseDays[2] || 'Sat',
			focus: '技术强化',
			main: [mk('倾斜臂屈伸', 3, '8-10', 120), mk('慢速离心臂屈伸', 3, '5-6', 120)],
			accessories: [mk('胸肩拉伸', 2, '30秒', 30)]
		};

		sessions.push(day1, day2, day3);

		if (input.weekly_frequency === 4) {
			const day4: EngineSession = {
				day: 'Sat',
				focus: '辅助强化',
				main: [mk('弹力带臂屈伸', 4, '15-20', 60)],
				accessories: [mk('肩部稳定训练', 3, '12-15', 45)]
			};
			sessions.push(day4);
		}
		weeks.push({ week: w, sessions });
	}

	return {
		meta: {
			title,
			duration_weeks: 6,
			frequency_per_week: input.weekly_frequency,
			goal: input.goal,
			experience_level: input.level,
			global_warmup: warmup,
			cooldown,
			safety_notes: notes
		},
		weeks
	};
};

// ---------------- Pullup + Dips Combo 6w ----------------
registry['pullup_dips_combo_6w'] = function generateComboPlan(input: EnhancedPlanInput): EnginePlan {
	const title = '引体+臂屈伸组合 6 周周期计划';
	const warmup: EngineExercise[] = [
		{ name: '全身动态热身', sets: 1, reps: '5分钟' },
		{ name: '肩袖激活', sets: 2, reps: '15-20' },
		{ name: '胸背伸展', sets: 2, reps: '10-12' }
	];
	const cooldown = [{ name: '全身拉伸', duration_min: 8 }];
	const notes = ['推拉交替训练，注意恢复', '根据体能状况调整训练强度'];

	const weeks: EngineWeek[] = [];
	const days = ['Mon', 'Tue', 'Thu', 'Fri'];

	const pullupLoad = calculateStartingLoad(input.assessment_data, 'weighted_pullup');
	const dipsLoad = calculateStartingLoad(input.assessment_data, 'weighted_dips');

	const mk = (
		name: string,
		sets: number,
		reps: string,
		rest_sec = 120,
		extra?: Partial<EngineExercise>
	): EngineExercise => ({
		name,
		sets,
		reps,
		rest_sec,
		...extra
	});

	for (let w = 1; w <= 6; w++) {
		const sessions: EngineSession[] = [];
		const intensity = 65 + (w - 1) * 3;

		const mon: EngineSession = {
			day: 'Mon',
			focus: '背部拉力',
			main: [
				mk('负重引体', 5, '5', 180, {
					load_type: pullupLoad.type,
					load_value: Math.round((pullupLoad.load * intensity) / 70)
				})
			],
			accessories: [mk('自重引体', 3, '力竭', 90), mk('肩胛稳定', 3, '12-15', 60)]
		};

		const tue: EngineSession = {
			day: 'Tue',
			focus: '胸部推力',
			main: [
				mk('负重臂屈伸', 5, '5', 180, {
					load_type: dipsLoad.type,
					load_value: Math.round((dipsLoad.load * intensity) / 70)
				})
			],
			accessories: [mk('自重臂屈伸', 3, '力竭', 90), mk('钻石俯卧撑', 3, '10-15', 60)]
		};

		const thu: EngineSession = {
			day: 'Thu',
			focus: '背部容量',
			main: [mk('自重引体', 4, '接近力竭', 120)],
			accessories: [mk('反握引体', 3, '8-12', 90), mk('核心训练', 3, '15-20', 60)]
		};

		const fri: EngineSession = {
			day: 'Fri',
			focus: '胸部容量',
			main: [mk('自重臂屈伸', 4, '接近力竭', 120)],
			accessories: [mk('倾斜臂屈伸', 3, '10-15', 90), mk('核心训练', 3, '15-20', 60)]
		};

		sessions.push(mon, tue, thu, fri);

		if (input.weekly_frequency === 5) {
			const sat: EngineSession = {
				day: 'Sat',
				focus: '综合强化',
				main: [mk('超级组：引体+臂屈伸', 4, '8-10', 180)],
				accessories: [mk('核心训练', 4, '15-20', 60)]
			};
			sessions.push(sat);
		}
		weeks.push({ week: w, sessions });
	}

	return {
		meta: {
			title,
			duration_weeks: 6,
			frequency_per_week: input.weekly_frequency,
			goal: input.goal,
			experience_level: input.level,
			global_warmup: warmup,
			cooldown,
			safety_notes: notes
		},
		weeks
	};
};

export async function generatePlanByCoachRules(input: EnhancedPlanInput): Promise<EnginePlan> {
	try {
		const domainToRulepackMap: Record<string, string> = {
			weighted_pullup: 'weighted_pullup_6w',
			weighted_dips: 'weighted_dips_6w',
			combo: 'pullup_dips_combo_6w'
		};
		const rulepackKey = domainToRulepackMap[input.domain];
		const generator = registry[rulepackKey];
		if (!generator) {
			throw new Error(`未找到规则包: ${rulepackKey} (domain: ${input.domain})`);
		}
		return generator(input);
	} catch (error) {
		console.error('规则包生成失败:', error);
		return registry['weighted_pullup_6w'](input);
	}
}

export async function getCoachRulepacks(coachId: string): Promise<any[]> {
	try {
		const { data, error } = await supabase
			.from('coach_rulepacks')
			.select('key, name, domain, description, form_schema')
			.eq('coach_id', coachId)
			.eq('is_active', true)
			.order('created_at', { ascending: true });
		if (error) throw error;
		return data || [];
	} catch (error) {
		console.error('获取规则包失败:', error);
		return [
			{ key: 'weighted_pullup_6w', name: '负重引体6周计划', domain: 'weighted_pullup', description: '专注于引体向上的力量发展' },
			{ key: 'weighted_dips_6w', name: '负重臂屈伸6周计划', domain: 'weighted_dips', description: '专注于臂屈伸的力量发展' },
			{ key: 'pullup_dips_combo_6w', name: '组合训练6周计划', domain: 'combo', description: '引体向上与臂屈伸的综合训练' }
		];
	}
}

export async function getRulepackConfig(coachId: string, domain: string): Promise<any> {
	try {
		const { data, error } = await supabase
			.from('coach_rulepacks')
			.select('*')
			.eq('coach_id', coachId)
			.eq('domain', domain)
			.eq('is_active', true)
			.order('version', { ascending: false })
			.limit(1)
			.single();
		if (error) throw error;
		return data;
	} catch (error) {
		console.error('获取规则包配置失败:', error);
		return null;
	}
}


