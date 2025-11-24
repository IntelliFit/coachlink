// Mock Data Store

const MockData = {
    // 运行时根据 Session + 页面上下文获取当前用户
    get currentUser() {
        if (window.location.pathname.includes('/admin/')) {
            return {
                id: 'admin_001',
                name: '系统管理员',
                role: 'admin',
                roles: ['admin'],
                avatar: '🛡️'
            };
        }
        if (typeof UserService !== 'undefined') {
            const user = UserService.getCurrentUser();
            const activeRole = UserService.getActiveRole();
            return {
                ...user,
                role: activeRole,
                roles: user.roles || [activeRole]
            };
        }
        return {
            id: 'student_001',
            name: '李明',
            role: 'student',
            roles: ['student'],
            avatar: '李'
        };
    },
    
    session: {
        currentUserId: 'student_001',
        activeRole: 'student'
    },

    users: [
        {
            id: 'student_001',
            name: '李明',
            avatar: '李',
            roles: ['student'],
            email: 'li.ming@example.com',
            phone: '13800000000',
            coachProfileId: null
        },
        {
            id: 'coach_001',
            name: '张教练',
            avatar: '张',
            roles: ['coach'],
            email: 'coach.zhang@example.com',
            phone: '13711112222',
            coachProfileId: 'coach_001'
        },
        {
            id: 'admin_001',
            name: '系统管理员',
            avatar: '🛡️',
            roles: ['admin'],
            email: 'admin@coachlink.com',
            phone: ''
        }
    ],

    coaches: [
        {
            id: 'coach_001',
            userId: 'coach_001',
            name: '张健',
            title: '力量举专家',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
            specialties: ['力量举', '增肌'],
            rating: 4.9,
            totalStudents: 150,
            status: 'approved'
        },
        {
            id: '2a8222e5-d835-4ba8-851b-88a88cda778f',
            userId: null,
            name: '李健强',
            title: '核心力量专家',
            avatarUrl: '',
            specialties: ['核心训练', '平板支撑', '功能性训练'],
            rating: 4.7,
            totalStudents: 890,
            status: 'pending'
        },
        {
            id: '87eec87c-aa2f-46bb-8208-4b54e261e492',
            userId: 'f9eac5b1-45f9-4479-9ab8-8223a5db8835',
            name: '枭马葛助理',
            title: '健身教练',
            avatarUrl: '',
            specialties: ['力量训练'],
            rating: 0,
            totalStudents: 0,
            status: 'approved'
        }
    ],

    coachApplications: [
        {
            id: 'app_demo_pending',
            userId: 'student_004',
            status: 'pending',
            submittedAt: Date.now() - 86400000 * 2,
            updatedAt: Date.now() - 86400000,
            reviewerId: null,
            reviewerName: null,
            rejectionReason: '',
            formData: {
                realName: '赵丽',
                tagline: '国家二级运动员 | 体能教练',
                specialties: ['体能训练', '体态纠正'],
                experienceYears: 4,
                bio: '拥有四年一线体能训练经验，擅长为女性学员设计灵活的增肌塑形方案。',
                achievements: '国家二级运动员；亚洲体能大赛前三',
                services: 'AI基础方案 + 每周1次真人点评',
                certificates: ['https://example.com/cert-1.png'],
                cases: '帮助学员三个月减脂6kg'
            }
        }
    ],
    
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

    studentProfiles: {
        'stu_001': {
            displayName: '李明',
            nickname: '李同学',
            avatarText: '李',
            role: '学员',
            subscriptionTier: '高级版',
            subscribedCoaches: 2,
            personalInfo: [
                { label: '姓名', value: '李明' },
                { label: '年龄', value: '28岁' },
                { label: '性别', value: '男' },
                { label: '地理位置', value: '上海' },
                { label: '职业', value: '软件工程师' },
                { label: '加入时长', value: '120天' }
            ],
            strengthData: [
                { label: '深蹲 1RM', value: '120 kg', accent: 'rgb(16, 185, 129)' },
                { label: '卧推 1RM', value: '100 kg', accent: 'rgb(236, 72, 153)' },
                { label: '硬拉 1RM', value: '140 kg', accent: 'rgb(249, 115, 22)' },
                { label: '总和', value: '360 kg', accent: 'rgb(99, 102, 241)' }
            ],
            bodyMetrics: [
                { label: '身高', value: '175 cm' },
                { label: '当前体重', value: '75 kg' },
                { label: '体脂率', value: '15%' },
                { label: '腕围', value: '17 cm' }
            ],
            trainingBackground: [
                { label: '系统训练时长', value: '2年' },
                { label: '训练频率', value: '每周4-5次' },
                { label: '主要目标', value: '增肌 + 力量' },
                { label: '恢复能力', value: '良好' }
            ],
            recentTraining: {
                date: '昨天',
                title: '胸部力量强化',
                summary: '完成度 100% · RPE 8.5'
            },
            timeline: [
                {
                    exercise: '卧推',
                    date: '2024年11月15日',
                    stats: ['100 kg × 8 次', 'RPE 9'],
                    videoThumbnail: 'https://placehold.co/600x400/6366f1/white?text=Training+Video',
                    videoUrl: 'https://example.com/bench_set3.mp4',
                    note: '第一次卧推突破100kg！感觉太棒了！💪',
                    coachComment: '做得很好！动作质量保持得不错，继续保持！下周可以尝试102.5kg。'
                },
                {
                    exercise: '深蹲',
                    date: '2024年11月10日',
                    stats: ['120 kg × 5 次', 'RPE 8.5'],
                    videoThumbnail: 'https://placehold.co/600x400/ec4899/white?text=Squat+Training',
                    videoUrl: 'https://example.com/squat_highlight.mp4',
                    note: '深蹲蹲得很深，膝盖稳定性提升明显！',
                    coachComment: '深度控制得很好！注意保持核心收紧，髋部启动。'
                },
                {
                    exercise: '硬拉',
                    date: '2024年11月5日',
                    stats: ['140 kg × 3 次', 'RPE 9'],
                    videoThumbnail: 'https://placehold.co/600x400/10b981/white?text=Deadlift',
                    videoUrl: 'https://example.com/deadlift_pr.mp4',
                    note: '首次硬拉140kg，背部感觉很稳！'
                }
            ],
            coachNotes: [
                { title: '动作模式评估', content: '卧推动作质量稳定，肩胛骨后缩做得很好。深蹲需要注意髋关节的启动顺序。' },
                { title: '训练建议', content: '近期睡眠时间偏少，建议保证每晚7-8小时睡眠，这对恢复和力量增长都很关键。' },
                { title: '下阶段目标', content: '重点提升深蹲稳定性，计划在4周内达到深蹲130kg×5。' }
            ]
        }
    },

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
    ],

    // Chat Messages
    messages: [
        {
            id: 'msg_001',
            sessionId: 'chat_stu001_coach001',
            senderId: 'student_001',
            content: '教练，我的深蹲感觉腰有点不舒服。',
            type: 'text', // text, image, voice, quote
            timestamp: Date.now() - 86400000 * 1, // 1 day ago
            read: true
        },
        {
            id: 'msg_002',
            sessionId: 'chat_stu001_coach001',
            senderId: 'coach_001',
            content: '发个视频我看看？',
            type: 'text',
            timestamp: Date.now() - 86400000 * 1 + 3600000,
            read: true
        },
        {
            id: 'msg_003',
            sessionId: 'chat_stu001_coach001',
            senderId: 'student_001',
            content: '教练，请看我这组深蹲',
            type: 'quote',
            quoteData: {
                 videoId: 'vid_001',
                 videoUrl: 'https://example.com/squat.mp4',
                 thumbnail: 'https://placehold.co/300x200/333/fff?text=Squat',
                 date: '2023-11-20',
                 exercise: '深蹲',
                 details: '100kg x 5'
            },
            timestamp: Date.now() - 3600000,
            read: false
        }
    ],

    // Active Chat Sessions
    chatSessions: [
        {
            id: 'chat_stu001_coach001',
            participants: ['student_001', 'coach_001'],
            lastMessage: '教练，请看我这组深蹲',
            lastMessageTime: Date.now() - 3600000,
            unreadCount: {
                'student_001': 0,
                'coach_001': 1
            }
        }
    ],

    // Student Videos (for quoting)
    videos: [
        {
            id: 'vid_001',
            userId: 'student_001',
            date: '2023-11-20',
            exercise: '深蹲',
            weight: '100kg',
            reps: '5',
            thumbnail: 'https://placehold.co/300x200/333/fff?text=Squat',
            url: 'https://example.com/squat.mp4'
        },
        {
            id: 'vid_002',
            userId: 'student_001',
            date: '2023-11-18',
            exercise: '卧推',
            weight: '80kg',
            reps: '8',
            thumbnail: 'https://placehold.co/300x200/333/fff?text=Bench',
            url: 'https://example.com/bench.mp4'
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
        if (!localStorage.getItem('coachlink_users')) {
            Store.set('users', MockData.users);
        }
        if (!localStorage.getItem('coachlink_session')) {
            Store.set('session', MockData.session);
        }
        if (!localStorage.getItem('coachlink_coaches')) {
            Store.set('coaches', MockData.coaches);
        }
        if (!localStorage.getItem('coachlink_coachApplications')) {
            Store.set('coachApplications', MockData.coachApplications);
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
        
        // Chat related data initialization
        if (!localStorage.getItem('coachlink_messages')) {
            Store.set('messages', MockData.messages);
        }
        if (!localStorage.getItem('coachlink_chatSessions')) {
            Store.set('chatSessions', MockData.chatSessions);
        }
        if (!localStorage.getItem('coachlink_videos')) {
            Store.set('videos', MockData.videos);
        }

        // Always update these for development/testing of new features
        Store.set('clientPlans', MockData.clientPlans);
        Store.set('clientExecution', MockData.clientExecution);
        Store.set('studentProfiles', MockData.studentProfiles);
    }
};

// Initialize on load
Store.init();

const UserService = {
    getUsers() {
        return Store.get('users') || [];
    },
    saveUsers(users) {
        Store.set('users', users);
    },
    findUserById(userId) {
        return UserService.getUsers().find(user => user.id === userId);
    },
    getSession() {
        return Store.get('session') || { ...MockData.session };
    },
    updateSession(patch) {
        const next = { ...UserService.getSession(), ...patch };
        Store.set('session', next);
        return next;
    },
    getCurrentUser() {
        const session = UserService.getSession();
        return (
            UserService.findUserById(session.currentUserId) ||
            UserService.getUsers()[0] || {
                id: 'student_001',
                name: '李明',
                roles: ['student'],
                avatar: '李'
            }
        );
    },
    getActiveRole() {
        const session = UserService.getSession();
        const user = UserService.getCurrentUser();
        return session.activeRole || (user.roles && user.roles[0]) || 'student';
    },
    updateUser(userId, patch) {
        const users = UserService.getUsers();
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return null;
        users[index] = { ...users[index], ...patch };
        UserService.saveUsers(users);
        return users[index];
    },
    addRole(userId, role) {
        const users = UserService.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const roles = new Set(user.roles || []);
        roles.add(role);
        user.roles = Array.from(roles);
        UserService.saveUsers(users);
    }
};

const CoachService = {
    ensureCoachProfile(userId, formData = {}) {
        const user = UserService.findUserById(userId);
        if (!user) return null;
        const profileId = user.coachProfileId || (user.id.startsWith('coach_') ? user.id : `coach_${user.id}`);

        const profiles = Store.get('coachProfiles') || {};
        if (!profiles[profileId]) {
            profiles[profileId] = {
                name: formData.realName || user.name,
                avatarUrl: formData.avatarUrl || '',
                tagline: formData.tagline || '',
                specialties: Array.isArray(formData.specialties) ? formData.specialties : [],
                aboutHtml: formData.bio ? `<p>${formData.bio}</p>` : '',
                successStories: formData.cases
                    ? [
                          {
                              title: '代表案例',
                              content: formData.cases,
                              images: []
                          }
                      ]
                    : []
            };
            Store.set('coachProfiles', profiles);
        }

        const pricing = Store.get('coachPricing') || {};
        if (!pricing[profileId]) {
            pricing[profileId] = {
                aiMonthly: 99,
                premiumMonthly: 299
            };
            Store.set('coachPricing', pricing);
        }

        const coaches = Store.get('coaches') || [];
        const existingIdx = coaches.findIndex(coach => coach.userId === userId || coach.id === profileId);
        const baseCoach = {
            id: profileId,
            userId,
            name: formData.realName || user.name,
            title: formData.tagline || '专业教练',
            avatarUrl: formData.avatarUrl || '',
            specialties: Array.isArray(formData.specialties) ? formData.specialties : [],
            rating: 0,
            totalStudents: 0,
            status: 'approved'
        };
        if (existingIdx === -1) {
            coaches.push(baseCoach);
        } else {
            coaches[existingIdx] = { ...coaches[existingIdx], ...baseCoach };
        }
        Store.set('coaches', coaches);

        UserService.updateUser(userId, { coachProfileId: profileId });
        return profileId;
    }
};

const CoachApplicationService = {
    getAll() {
        return Store.get('coachApplications') || [];
    },
    saveAll(applications) {
        Store.set('coachApplications', applications);
    },
    getByUserId(userId) {
        return CoachApplicationService.getAll().find(app => app.userId === userId);
    },
    ensureForUser(userId, options = {}) {
        const applications = options.applications || CoachApplicationService.getAll();
        let app = applications.find(item => item.userId === userId);
        if (!app) {
            app = {
                id: `app_${userId}`,
                userId,
                status: 'draft',
                submittedAt: null,
                updatedAt: Date.now(),
                reviewerId: null,
                reviewerName: null,
                rejectionReason: '',
                formData: CoachApplicationService.createEmptyForm(userId)
            };
            applications.push(app);
            if (!options.skipAutoSave) {
                CoachApplicationService.saveAll(applications);
            }
        }
        return app;
    },
    createEmptyForm(userId) {
        const user = UserService.findUserById(userId);
        return {
            realName: user?.name || '',
            avatarUrl: '',
            tagline: '',
            specialties: [],
            experienceYears: '',
            bio: '',
            achievements: '',
            services: '',
            certificates: [],
            cases: ''
        };
    },
    saveDraft(userId, formData) {
        const applications = CoachApplicationService.getAll();
        const app = CoachApplicationService.ensureForUser(userId, { applications, skipAutoSave: true });
        app.formData = { ...app.formData, ...formData };
        if (app.status !== 'pending') {
            app.status = 'draft';
        }
        app.updatedAt = Date.now();
        CoachApplicationService.saveAll(applications);
        return app;
    },
    submit(userId, formData) {
        const applications = CoachApplicationService.getAll();
        const app = CoachApplicationService.ensureForUser(userId, { applications, skipAutoSave: true });
        app.formData = { ...app.formData, ...formData };
        app.status = 'pending';
        app.submittedAt = Date.now();
        app.updatedAt = app.submittedAt;
        app.rejectionReason = '';
        CoachApplicationService.saveAll(applications);
        return app;
    },
    withdraw(appId) {
        const applications = CoachApplicationService.getAll();
        const app = applications.find(item => item.id === appId);
        if (!app) return null;
        app.status = 'draft';
        app.updatedAt = Date.now();
        CoachApplicationService.saveAll(applications);
        return app;
    },
    approve(appId, reviewer) {
        const applications = CoachApplicationService.getAll();
        const app = applications.find(item => item.id === appId);
        if (!app) return null;
        app.status = 'approved';
        app.updatedAt = Date.now();
        app.reviewerId = reviewer?.id || null;
        app.reviewerName = reviewer?.name || '';
        app.rejectionReason = '';
        CoachApplicationService.saveAll(applications);
        UserService.addRole(app.userId, 'coach');
        CoachService.ensureCoachProfile(app.userId, app.formData);
        return app;
    },
    reject(appId, reviewer, reason = '') {
        const applications = CoachApplicationService.getAll();
        const app = applications.find(item => item.id === appId);
        if (!app) return null;
        app.status = 'rejected';
        app.updatedAt = Date.now();
        app.reviewerId = reviewer?.id || null;
        app.reviewerName = reviewer?.name || '';
        app.rejectionReason = reason;
        CoachApplicationService.saveAll(applications);
        return app;
    }
};

const RoleManager = {
    getActiveRole() {
        return UserService.getActiveRole();
    },
    getActiveCoachProfileId() {
        const user = UserService.getCurrentUser();
        return user?.coachProfileId || user?.id;
    },
    switchRole(role, options = {}) {
        const user = UserService.getCurrentUser();
        if (!user?.roles?.includes(role)) {
            alert('当前账号尚未拥有该角色权限');
            return false;
        }
        UserService.updateSession({ activeRole: role });
        if (!options.silent) {
            window.location.href = RoleManager.getRedirectPath(role);
        }
        return true;
    },
    getRedirectPath(role) {
        const path = window.location.pathname;
        if (role === 'coach') {
            if (path.includes('/coach/')) return 'dashboard.html';
            if (path.includes('/student/') || path.includes('/admin/')) return '../coach/dashboard.html';
            return 'coach/dashboard.html';
        }
        if (path.includes('/student/')) return 'dashboard.html';
        if (path.includes('/coach/') || path.includes('/admin/')) return '../student/dashboard.html';
        return 'student/dashboard.html';
    }
};

window.UserService = UserService;
window.CoachApplicationService = CoachApplicationService;
window.CoachService = CoachService;
window.RoleManager = RoleManager;
