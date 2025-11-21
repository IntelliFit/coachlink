// Mock Data Store

const MockData = {
    // Dynamically determine user based on URL
    get currentUser() {
        const path = window.location.pathname;
        if (path.includes('/coach/')) {
            return {
                id: 'coach_001',
                name: '张教练',
                role: 'coach',
                avatar: '张'
            };
        } else if (path.includes('/admin/')) {
            return {
                id: 'admin_001',
                name: '系统管理员',
                role: 'admin',
                avatar: '🛡️'
            };
        } else {
            return {
                id: 'student_001',
                name: '李明',
                role: 'student',
                avatar: '李'
            };
        }
    },
    
    exercises: [
        { id: 'ex_001', name: '引体向上', type: 'strength', muscle: 'back', equipment: 'bar', details: '双手宽握单杠，核心收紧，背部发力将身体拉起,直至下巴过杠。', videoUrl: 'https://example.com/pullup.mp4' },
        { id: 'ex_002', name: '俯卧撑', type: 'strength', muscle: 'chest', equipment: 'bodyweight', details: '双手略宽于肩，身体呈一条直线，屈肘下放至胸部贴近地面，推起还原。', videoUrl: '' },
        { id: 'ex_003', name: '深蹲', type: 'strength', muscle: 'legs', equipment: 'barbell', details: '双脚开立与肩同宽，背部挺直，屈髋屈膝下蹲，直至大腿平行地面。', videoUrl: '' },
        { id: 'ex_004', name: '平板支撑', type: 'core', muscle: 'abs', equipment: 'bodyweight', details: '前臂撑地，身体呈一条直线，保持核心收紧。', videoUrl: '' },
        { id: 'ex_005', name: '哑铃卧推', type: 'strength', muscle: 'chest', equipment: 'dumbbell', details: '仰卧于平凳，双手持哑铃，推起至手臂伸直，下放至胸部两侧。', videoUrl: '' },
        { id: 'ex_006', name: '杠铃卧推', type: 'strength', muscle: 'chest', equipment: 'barbell', details: '仰卧于平凳，双手持杠铃，推起至手臂伸直，下放至胸部两侧。', videoUrl: '' }
    ],

    templates: [
        { 
            id: 'tpl_001', 
            name: '上肢力量基础', 
            description: '适合初学者的上肢力量训练',
            exercises: [
                { exerciseId: 'ex_001', sets: 3, reps: '8-12', rpe: 7 },
                { exerciseId: 'ex_002', sets: 3, reps: '10-15', rpe: 8 }
            ],
            planData: [
                {
                    id: 1,
                    title: '第 1 周',
                    days: [
                        { id: 1, title: 'Day 1', content: '<div class="p-md text-center text-secondary">上肢力量基础 - Day 1 内容</div>', isRestDay: false },
                        { id: 2, title: 'Day 2', content: '', isRestDay: true },
                        { id: 3, title: 'Day 3', content: '<div class="p-md text-center text-secondary">上肢力量基础 - Day 3 内容</div>', isRestDay: false },
                        { id: 4, title: 'Day 4', content: '', isRestDay: true },
                        { id: 5, title: 'Day 5', content: '', isRestDay: false },
                        { id: 6, title: 'Day 6', content: '', isRestDay: true },
                        { id: 7, title: 'Day 7', content: '', isRestDay: true }
                    ]
                }
            ]
        },
        { 
            id: 'tpl_002', 
            name: '全身燃脂HIIT', 
            description: '高强度间歇训练',
            exercises: [
                { exerciseId: 'ex_003', sets: 4, reps: '20', rpe: 9 },
                { exerciseId: 'ex_004', sets: 4, reps: '60s', rpe: 8 }
            ]
        }
    ],

    clients: [
        { id: 'stu_001', name: '李同学', plan: '增肌计划 A', status: 'active', lastActive: '2小时前', subscriptionMonths: 4 },
        { id: 'stu_002', name: '王小明', plan: '减脂冲刺', status: 'active', lastActive: '1天前', subscriptionMonths: 1 },
        { id: 'stu_003', name: '赵铁柱', plan: '力量举备赛', status: 'inactive', lastActive: '5天前', subscriptionMonths: 3 }
    ],

    // Coach profiles (homepage editable data)
    coachProfiles: {
        'coach_001': {
            name: '张健',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
            tagline: '10年力量举经验 | 国家级运动员 | 帮助超过150名学员实现目标',
            specialties: ['力量举', '增肌'],
            aboutHtml: '<p class="mb-md">大家好，我是张健，专注力量举训练10年，国家级运动健将。我的训练理念是<strong>“科学训练，持续进步”</strong>。</p><p class="mb-md">我相信每个人都有潜力突破自己的极限。通过系统化的训练计划和精准的动作指导，我已经帮助超过150名学员实现了他们的健身目标。</p><p><strong>资质认证:</strong></p><ul style="list-style: disc; margin-left: 2rem; line-height: 2;"><li>国家级运动健将</li><li>NSCA-CPT认证私人教练</li><li>10年力量举训练经验</li></ul>',
            successStories: [
                {
                    title: '帮助学员三个月卧推提升20kg',
                    content: '跟着张教练训练3个月，卧推从60kg突破到80kg！教练不仅给我科学的计划，还每天监督我的动作视频，纠正细节。非常专业！ - 学员小李',
                    images: [
                        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=300&fit=crop',
                        'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=300&h=300&fit=crop'
                    ]
                },
                {
                    title: '6个月增重12kg纯肌肉',
                    content: '作为一个瘦子，增肌一直是我的难题。张教练为我定制了详细的训练+饮食方案，半年时间我从65kg增到77kg，体脂率还降了！ - 学员王强',
                    images: []
                }
            ]
        },
        'coach_002': {
            name: '李明',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=coach-li',
            tagline: '国家二级运动员 | 私教8年 | 专注减脂与动作纠正',
            specialties: ['减脂', '动作纠正'],
            aboutHtml: '<p>我是李明教练，擅长通过循序渐进的方法帮你减脂并建立健康的运动习惯。</p>',
            successStories: [
                { title: '三个月减脂8kg', content: '配合饮食与有氧力量结合，健康降脂。', images: [] }
            ]
        }
    },

    // Coach pricing (Services & Pricing)
    coachPricing: {
        'coach_001': { aiMonthly: 99, premiumMonthly: 299 },
        'coach_002': { aiMonthly: 79, premiumMonthly: 259 }
    },

    // Coach published contents
    coachContent: {
        'coach_001': [
            { id: 'cnt_001', title: '力量举三大项完整教学', summary: '深蹲、卧推、硬拉的标准动作要领', type: 'article', url: '#', visibility: 'public' },
            { id: 'cnt_002', title: '如何突破训练平台期', summary: '5个实用技巧帮你持续进步', type: 'article', url: '#', visibility: 'public' },
            { id: 'cnt_003', title: '高级增肌营养方案', summary: '订阅后可查看完整内容', type: 'article', url: '#', visibility: 'paid' }
        ],
        'coach_002': [
            { id: 'cnt_101', title: '热量赤字与饮食规划', summary: '科学饮食的核心原则', type: 'article', url: '#', visibility: 'public' }
        ]
    },

    // Simple subscriptions map: which student subscribed to which coach and tier
    subscriptions: {
        'student_001': { 'coach_001': 'ai', 'coach_002': 'premium' } // 'none' | 'ai' | 'premium'
    },

    // Subscription settings (e.g., auto renew)
    subscriptionSettings: {
        'student_001': {
            'coach_001': { autoRenew: true, nextBillingDate: '2025-12-01' },
            'coach_002': { autoRenew: false, nextBillingDate: '2025-12-10' }
        }
    },

    clientPlans: {
        'stu_001': [ // Plan for Li Tongxue (Muscle Gain Plan A)
            {
                id: 1,
                title: '第 1 周',
                days: [
                    { id: 1, title: 'Day 1', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg text-primary hover:underline cursor-pointer" onclick="viewExerciseDetails(\'ex_006\')">杠铃卧推</div><div class="text-xs text-secondary">胸部 · 杠铃</div></div></div><div class="row-details">4组 x 8-12次</div></div><div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg text-primary hover:underline cursor-pointer" onclick="viewExerciseDetails(\'ex_003\')">深蹲</div><div class="text-xs text-secondary">腿部 · 杠铃</div></div></div><div class="row-details">4组 x 10次</div></div>', isRestDay: false },
                    { id: 2, title: 'Day 2', content: '', isRestDay: true },
                    { id: 3, title: 'Day 3', content: '', isRestDay: false },
                    { id: 4, title: 'Day 4', content: '', isRestDay: false },
                    { id: 5, title: 'Day 5', content: '', isRestDay: true },
                    { id: 6, title: 'Day 6', content: '', isRestDay: false },
                    { id: 7, title: 'Day 7', content: '', isRestDay: true }
                ]
            }
        ]
        // stu_002 has no plan set yet
    },

    clientExecution: {
        'stu_001': {
            'week_1_day_1': {
                completed: true,
                date: '2023-11-20',
                feedback: '卧推感觉不错，最后一次有点吃力。',
                exercises: [
                    { 
                        name: '杠铃卧推', 
                        planned: '4组 x 8-12次', 
                        actual: '4组 x 10次 (60kg)', 
                        video: 'https://example.com/video1.mp4',
                        sets: [
                            { weight: '100kg', reps: 8, rpe: 10, rest: '3min', note: '感觉很重，动作有变形', video: 'https://example.com/bench_set1.mp4' },
                            { weight: '97.5kg', reps: 8, rpe: 9, rest: '3min', video: 'https://example.com/bench_set2.mp4' },
                            { weight: '95kg', reps: 8, rpe: 8.5, rest: '3min', video: 'https://example.com/bench_set3.mp4' },
                            { weight: '95kg', reps: 8, rpe: 9, rest: '3min', video: 'https://example.com/bench_set4.mp4' }
                        ]
                    },
                    { 
                        name: '深蹲', 
                        planned: '4组 x 10次', 
                        actual: '4组 x 10次 (60kg)', 
                        video: '',
                        sets: [
                            { weight: '60kg', reps: 10, rpe: 7, rest: '2min' },
                            { weight: '60kg', reps: 10, rpe: 7.5, rest: '2min' },
                            { weight: '60kg', reps: 10, rpe: 8, rest: '2min' },
                            { weight: '60kg', reps: 10, rpe: 8.5, rest: '2min' }
                        ]
                    }
                ]
            }
        }
    },

    // Leaderboard Submissions
    submissions: [
        {
            id: 'sub_001',
            userId: 'student_001',
            userName: '李明',
            userAvatar: '李',
            leaderboardId: 'pullup_weighted',
            value: 120.5,
            details: { weight: 50, bodyweight: 70.5, reps: 1, ruleType: 'strict' },
            videoUrl: 'https://example.com/video1.mp4',
            status: 'approved',
            timestamp: Date.now() - 86400000 * 7,
            reviewedAt: Date.now() - 86400000 * 6,
            reviewerId: 'coach_001',
            reviewerName: '张教练'
        },
        {
            id: 'sub_002',
            userId: 'student_002',
            userName: '王强',
            userAvatar: '王',
            leaderboardId: 'pullup_weighted',
            value: 135.0,
            details: { weight: 60, bodyweight: 75, reps: 1, ruleType: 'strict' },
            videoUrl: 'https://example.com/video2.mp4',
            status: 'approved',
            timestamp: Date.now() - 86400000 * 5,
            reviewedAt: Date.now() - 86400000 * 4,
            reviewerId: 'coach_001',
            reviewerName: '张教练'
        },
        {
            id: 'sub_003',
            userId: 'student_001',
            userName: '李明',
            userAvatar: '李',
            leaderboardId: 'squat',
            value: 150,
            details: { weight: 150, bodyweight: 70.5 },
            videoUrl: 'https://example.com/video3.mp4',
            status: 'pending',
            timestamp: Date.now() - 86400000 * 1
        },
        {
            id: 'sub_004',
            userId: 'student_003',
            userName: '赵丽',
            userAvatar: '赵',
            leaderboardId: 'pullup_bodyweight',
            value: 25,
            details: { reps: 25, bodyweight: 58 },
            videoUrl: 'https://example.com/video4.mp4',
            status: 'approved',
            timestamp: Date.now() - 86400000 * 10,
            reviewedAt: Date.now() - 86400000 * 9,
            reviewerId: 'coach_001',
            reviewerName: '张教练'
        },
        {
            id: 'sub_005',
            userId: 'student_004',
            userName: '孙浩',
            userAvatar: '孙',
            leaderboardId: 'bench_press',
            value: 120,
            details: { weight: 120, bodyweight: 80, ruleType: 'competition' },
            videoUrl: 'https://example.com/video5.mp4',
            status: 'approved',
            timestamp: Date.now() - 86400000 * 3,
            reviewedAt: Date.now() - 86400000 * 2,
            reviewerId: 'coach_001',
            reviewerName: '张教练'
        }
    ]
};

// Simple Store wrapper for localStorage
const Store = {
    get: (key) => {
        const data = localStorage.getItem(`coachlink_${key}`);
        return data ? JSON.parse(data) : MockData[key];
    },
    set: (key, value) => {
        localStorage.setItem(`coachlink_${key}`, JSON.stringify(value));
    },
    init: () => {
        if (!localStorage.getItem('coachlink_exercises')) {
            Store.set('exercises', MockData.exercises);
        }
        if (!localStorage.getItem('coachlink_templates')) {
            Store.set('templates', MockData.templates);
        }
        if (!localStorage.getItem('coachlink_submissions')) {
            Store.set('submissions', MockData.submissions);
        }
        if (!localStorage.getItem('coachlink_coachProfiles')) {
            Store.set('coachProfiles', MockData.coachProfiles);
        }
        if (!localStorage.getItem('coachlink_coachPricing')) {
            Store.set('coachPricing', MockData.coachPricing);
        }
        if (!localStorage.getItem('coachlink_coachContent')) {
            Store.set('coachContent', MockData.coachContent);
        }
        if (!localStorage.getItem('coachlink_subscriptions_map')) {
            Store.set('subscriptions', MockData.subscriptions);
        }
        if (!localStorage.getItem('coachlink_subscriptionSettings')) {
            Store.set('subscriptionSettings', MockData.subscriptionSettings);
        }
        // Always update these for development/testing of new features
        Store.set('clientPlans', MockData.clientPlans);
        Store.set('clientExecution', MockData.clientExecution);
    }
};

// Initialize on load
Store.init();
