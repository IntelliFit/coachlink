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
            id: 'student_maliu',
            name: '马六',
            role: 'student',
            roles: ['student'],
            avatar: '马'
        };
    },
    
    session: {
        currentUserId: 'student_maliu',
        activeRole: 'student'
    },

    // ========== 用户体系设计 ==========
    // 所有教练都是从学员身份开始，申请成功后成为双角色（student + coach）
    // 马六：纯学员，从未申请过教练
    // 王五：学员，正在申请教练（pending状态）
    // 李明：双角色用户，申请已通过，可在学员端和教练端切换
    // 张教练：双角色用户，申请已通过，可在学员端和教练端切换（学员端为空，因为没有订阅任何人）
    // 管理员：系统管理员
    users: [
        {
            id: 'student_maliu',
            name: '马六',
            avatar: '马',
            roles: ['student'],  // 纯学员，可以申请成为教练
            email: 'ma.liu@example.com',
            phone: '13800000001',
            coachProfileId: null
        },
        {
            id: 'student_wangwu',
            name: '王五',
            avatar: '王',
            roles: ['student'],  // 学员，已提交教练申请，等待审核
            email: 'wang.wu@example.com',
            phone: '13800000002',
            coachProfileId: null
        },
        {
            id: 'student_liming',
            name: '李明',
            avatar: '李',
            roles: ['student', 'coach'],  // 双角色：学员+教练，申请已通过
            email: 'li.ming@example.com',
            phone: '13800000003',
            coachProfileId: 'coach_liming'
        },
        {
            id: 'coach_zhang',
            name: '张教练',
            avatar: '张',
            roles: ['student', 'coach'],  // 双角色：学员+教练，申请已通过（学员端为空，因为没有订阅）
            email: 'coach.zhang@example.com',
            phone: '13711112222',
            coachProfileId: 'coach_zhang'
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
            // 张教练：纯教练账号的教练档案
            id: 'coach_zhang',
            userId: 'coach_zhang',
            name: '张教练',
            title: '力量举专家',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
            specialties: ['力量举', '增肌'],
            rating: 4.9,
            totalStudents: 150,
            status: 'approved'
        },
        {
            // 李明：双角色用户的教练档案（申请通过后创建）
            id: 'coach_liming',
            userId: 'student_liming',
            name: '李明',
            title: '新晋健身教练',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=liming',
            specialties: ['力量训练', '体能提升'],
            rating: 4.2,
            totalStudents: 5,
            status: 'approved'
        }
    ],

    coachApplications: [
        {
            // 张教练的教练申请：已通过（最早申请的教练）
            id: 'app_zhang_approved',
            userId: 'coach_zhang',
            status: 'approved',
            submittedAt: Date.now() - 86400000 * 365,  // 一年前申请
            updatedAt: Date.now() - 86400000 * 360,
            reviewerId: 'admin_001',
            reviewerName: '系统管理员',
            rejectionReason: '',
            formData: {
                realName: '张健',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
                tagline: '10年力量举经验 | 国家级运动员',
                specialties: ['力量举', '增肌'],
                experienceYears: 10,
                bio: '专注力量举训练10年，国家级运动健将。训练理念是"科学训练，持续进步"。',
                achievements: '国家级运动健将；NSCA-CPT认证私人教练',
                services: 'AI方案 + 每周2次真人指导',
                certificates: ['国家级运动健将证书', 'NSCA-CPT认证'],
                cases: '帮助超过150名学员实现健身目标'
            }
        },
        {
            // 李明的教练申请：已通过
            id: 'app_liming_approved',
            userId: 'student_liming',
            status: 'approved',
            submittedAt: Date.now() - 86400000 * 30,
            updatedAt: Date.now() - 86400000 * 25,
            reviewerId: 'admin_001',
            reviewerName: '系统管理员',
            rejectionReason: '',
            formData: {
                realName: '李明',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=liming',
                tagline: '新晋健身教练 | 力量训练爱好者',
                specialties: ['力量训练', '体能提升'],
                experienceYears: 2,
                bio: '从学员成长为教练，深知学员的需求和困惑，擅长帮助新手快速入门。',
                achievements: '个人卧推100kg+，深蹲120kg+',
                services: 'AI基础方案 + 动作指导',
                certificates: ['健身教练国职证书'],
                cases: '帮助5名学员实现力量突破'
            }
        },
        {
            // 王五的教练申请：正在审核中
            id: 'app_wangwu_pending',
            userId: 'student_wangwu',
            status: 'pending',
            submittedAt: Date.now() - 86400000 * 2,
            updatedAt: Date.now() - 86400000,
            reviewerId: null,
            reviewerName: null,
            rejectionReason: '',
            formData: {
                realName: '王五',
                avatarUrl: '',
                tagline: '国家二级运动员 | 体能教练',
                specialties: ['体能训练', '体态纠正'],
                experienceYears: 4,
                bio: '拥有四年一线体能训练经验，擅长为学员设计灵活的增肌塑形方案。',
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

    // 教练的学员列表 - 根据订阅关系动态生成
    // 张教练的学员：李明(premium)、马六(ai)、王五(premium)
    // 李明教练的学员：马六(ai)、王五(ai)
    clients: {
        'coach_zhang': [
            { id: 'student_liming', name: '李明', plan: '力量进阶计划', status: 'active', lastActive: '2小时前', subscriptionMonths: 4, tier: 'premium', hasPlan: true },
            { id: 'student_maliu', name: '马六', plan: '新手增肌计划', status: 'active', lastActive: '1天前', subscriptionMonths: 2, tier: 'ai', hasPlan: true },
            { id: 'student_wangwu', name: '王五', plan: '', status: 'active', lastActive: '3小时前', subscriptionMonths: 1, tier: 'premium', hasPlan: false }
        ],
        'coach_liming': [
            { id: 'student_maliu', name: '马六', plan: '腿部基础训练', status: 'active', lastActive: '1天前', subscriptionMonths: 1, tier: 'ai', hasPlan: true },
            { id: 'student_wangwu', name: '王五', plan: '', status: 'active', lastActive: '3小时前', subscriptionMonths: 1, tier: 'ai', hasPlan: false }
        ]
    },

    // 学员档案数据
    // 键名对应 clients 中的学员ID
    studentProfiles: {
        'student_liming': {
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
        },
        'student_maliu': {
            displayName: '马六',
            nickname: '马六',
            avatarText: '马',
            role: '学员',
            subscriptionTier: 'AI版',
            subscribedCoaches: 2,
            personalInfo: [
                { label: '姓名', value: '马六' },
                { label: '年龄', value: '25岁' },
                { label: '性别', value: '男' },
                { label: '地理位置', value: '北京' },
                { label: '职业', value: '产品经理' },
                { label: '加入时长', value: '30天' }
            ],
            strengthData: [
                { label: '深蹲 1RM', value: '60 kg', accent: 'rgb(16, 185, 129)' },
                { label: '卧推 1RM', value: '50 kg', accent: 'rgb(236, 72, 153)' },
                { label: '硬拉 1RM', value: '70 kg', accent: 'rgb(249, 115, 22)' },
                { label: '总和', value: '180 kg', accent: 'rgb(99, 102, 241)' }
            ],
            bodyMetrics: [
                { label: '身高', value: '178 cm' },
                { label: '当前体重', value: '72 kg' },
                { label: '体脂率', value: '18%' },
                { label: '腕围', value: '16 cm' }
            ],
            trainingBackground: [
                { label: '系统训练时长', value: '1个月' },
                { label: '训练频率', value: '每周3次' },
                { label: '主要目标', value: '增肌' },
                { label: '恢复能力', value: '一般' }
            ],
            recentTraining: {
                date: '昨天',
                title: '腿部基础训练',
                summary: '完成度 80% · RPE 7'
            },
            timeline: [
                {
                    exercise: '深蹲',
                    date: '2024年11月18日',
                    stats: ['60 kg × 10 次', 'RPE 8'],
                    videoThumbnail: 'https://placehold.co/600x400/6366f1/white?text=Squat',
                    videoUrl: 'https://example.com/maliu_squat.mp4',
                    note: '第一次完成60kg深蹲！',
                    coachComment: '动作不错，注意膝盖不要内扣。'
                }
            ],
            coachNotes: [
                { title: '动作模式评估', content: '新手学员，动作模式正在建立中。深蹲需要加强核心稳定性。' },
                { title: '训练建议', content: '建议先以轻重量打好基础，不要急于加重。' },
                { title: '下阶段目标', content: '在2周内掌握三大项的基本动作模式。' }
            ]
        },
        'student_wangwu': {
            displayName: '王五',
            nickname: '王五',
            avatarText: '王',
            role: '学员',
            subscriptionTier: '高级版',
            subscribedCoaches: 2,
            personalInfo: [
                { label: '姓名', value: '王五' },
                { label: '年龄', value: '30岁' },
                { label: '性别', value: '男' },
                { label: '地理位置', value: '深圳' },
                { label: '职业', value: '体能教练' },
                { label: '加入时长', value: '7天' }
            ],
            strengthData: [
                { label: '深蹲 1RM', value: '100 kg', accent: 'rgb(16, 185, 129)' },
                { label: '卧推 1RM', value: '80 kg', accent: 'rgb(236, 72, 153)' },
                { label: '硬拉 1RM', value: '120 kg', accent: 'rgb(249, 115, 22)' },
                { label: '总和', value: '300 kg', accent: 'rgb(99, 102, 241)' }
            ],
            bodyMetrics: [
                { label: '身高', value: '180 cm' },
                { label: '当前体重', value: '80 kg' },
                { label: '体脂率', value: '16%' },
                { label: '腕围', value: '18 cm' }
            ],
            trainingBackground: [
                { label: '系统训练时长', value: '4年' },
                { label: '训练频率', value: '每周5次' },
                { label: '主要目标', value: '体能训练' },
                { label: '恢复能力', value: '良好' }
            ],
            recentTraining: null,
            timeline: [],
            coachNotes: [
                { title: '初步评估', content: '有一定训练基础，正在等待制定个性化训练计划。' }
            ]
        }
    },

    // Coach profiles (homepage editable data)
    coachProfiles: {
        'coach_zhang': {
            name: '张教练',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
            tagline: '10年力量举经验 | 国家级运动员 | 帮助超过150名学员实现目标',
            specialties: ['力量举', '增肌'],
            aboutHtml: '<p class="mb-md">大家好，我是张教练，专注力量举训练10年，国家级运动健将。我的训练理念是<strong>"科学训练，持续进步"</strong>。</p><p class="mb-md">我相信每个人都有潜力突破自己的极限。通过系统化的训练计划和精准的动作指导，我已经帮助超过150名学员实现了他们的健身目标。</p><p><strong>资质认证:</strong></p><ul style="list-style: disc; margin-left: 2rem; line-height: 2;"><li>国家级运动健将</li><li>NSCA-CPT认证私人教练</li><li>10年力量举训练经验</li></ul>',
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
        'coach_liming': {
            name: '李明',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=liming',
            tagline: '新晋健身教练 | 力量训练爱好者 | 从学员到教练的蜕变',
            specialties: ['力量训练', '体能提升'],
            aboutHtml: '<p class="mb-md">大家好，我是李明！从一名普通学员成长为教练，我深知每一位新手的困惑和需求。</p><p class="mb-md">我的训练理念是<strong>"循序渐进，稳扎稳打"</strong>。我会根据你的实际情况，制定最适合你的训练计划。</p><p><strong>个人成绩:</strong></p><ul style="list-style: disc; margin-left: 2rem; line-height: 2;"><li>卧推 100kg+</li><li>深蹲 120kg+</li><li>健身教练国职证书</li></ul>',
            successStories: [
                {
                    title: '帮助5名学员实现力量突破',
                    content: '作为新教练，我特别用心对待每一位学员。已经帮助5名学员突破了他们的力量瓶颈！',
                    images: []
                }
            ]
        }
    },

    // Coach pricing (Services & Pricing)
    coachPricing: {
        'coach_zhang': { aiMonthly: 99, premiumMonthly: 299 },
        'coach_liming': { aiMonthly: 59, premiumMonthly: 199 }
    },

    // Coach published contents
    coachContent: {
        'coach_zhang': [
            { id: 'cnt_001', title: '力量举三大项完整教学', summary: '深蹲、卧推、硬拉的标准动作要领', type: 'article', url: '#', visibility: 'public' },
            { id: 'cnt_002', title: '如何突破训练平台期', summary: '5个实用技巧帮你持续进步', type: 'article', url: '#', visibility: 'public' },
            { id: 'cnt_003', title: '高级增肌营养方案', summary: '订阅后可查看完整内容', type: 'article', url: '#', visibility: 'paid' }
        ],
        'coach_liming': [
            { id: 'cnt_201', title: '新手力量训练入门指南', summary: '从零开始的力量训练之路', type: 'article', url: '#', visibility: 'public' }
        ]
    },

    // Simple subscriptions map: which student subscribed to which coach and tier
    // 马六：订阅了张教练和李明教练
    // 王五：订阅了张教练和李明教练
    // 李明：只订阅了张教练（不能订阅自己）
    // 张教练：没有订阅任何人（学员端为空）
    subscriptions: {
        'student_maliu': { 'coach_zhang': 'ai', 'coach_liming': 'ai' },
        'student_wangwu': { 'coach_zhang': 'premium', 'coach_liming': 'ai' },
        'student_liming': { 'coach_zhang': 'premium' },  // 李明只订阅张教练，不能订阅自己
        'coach_zhang': {}  // 张教练没有订阅任何人
    },

    // Subscription settings (e.g., auto renew)
    subscriptionSettings: {
        'student_001': {
            'coach_001': { autoRenew: true, nextBillingDate: '2025-12-01' },
            'coach_002': { autoRenew: false, nextBillingDate: '2025-12-10' }
        }
    },

    // 学员训练计划数据
    // 键名对应 clients 中的学员ID
    clientPlans: {
        // 李明的训练计划（张教练制定）
        'student_liming': [
            {
                id: 1,
                title: '第 1 周',
                days: [
                    { id: 1, title: 'Day 1', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg text-primary hover:underline cursor-pointer" onclick="viewExerciseDetails(\'ex_006\')">杠铃卧推</div><div class="text-xs text-secondary">胸部 · 杠铃</div></div></div><div class="row-details">4组 x 8-12次</div></div><div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg text-primary hover:underline cursor-pointer" onclick="viewExerciseDetails(\'ex_003\')">深蹲</div><div class="text-xs text-secondary">腿部 · 杠铃</div></div></div><div class="row-details">4组 x 10次</div></div>', isRestDay: false },
                    { id: 2, title: 'Day 2', content: '', isRestDay: true },
                    { id: 3, title: 'Day 3', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">引体向上</div><div class="text-xs text-secondary">背部 · 单杠</div></div></div><div class="row-details">4组 x 8-10次</div></div>', isRestDay: false },
                    { id: 4, title: 'Day 4', content: '', isRestDay: true },
                    { id: 5, title: 'Day 5', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">硬拉</div><div class="text-xs text-secondary">背部 · 杠铃</div></div></div><div class="row-details">5组 x 5次</div></div>', isRestDay: false },
                    { id: 6, title: 'Day 6', content: '', isRestDay: true },
                    { id: 7, title: 'Day 7', content: '', isRestDay: true }
                ]
            }
        ],
        // 马六的训练计划（张教练制定）
        'student_maliu': [
            {
                id: 1,
                title: '第 1 周',
                days: [
                    { id: 1, title: 'Day 1', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">俯卧撑</div><div class="text-xs text-secondary">胸部 · 徒手</div></div></div><div class="row-details">3组 x 15次</div></div><div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">哑铃卧推</div><div class="text-xs text-secondary">胸部 · 哑铃</div></div></div><div class="row-details">3组 x 12次</div></div>', isRestDay: false },
                    { id: 2, title: 'Day 2', content: '', isRestDay: true },
                    { id: 3, title: 'Day 3', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">深蹲</div><div class="text-xs text-secondary">腿部 · 杠铃</div></div></div><div class="row-details">3组 x 12次</div></div>', isRestDay: false },
                    { id: 4, title: 'Day 4', content: '', isRestDay: true },
                    { id: 5, title: 'Day 5', content: '<div class="exercise-row"><div class="row-header"><div class="flex-1"><div class="font-semibold text-lg">引体向上</div><div class="text-xs text-secondary">背部 · 单杠</div></div></div><div class="row-details">3组 x 8次</div></div>', isRestDay: false },
                    { id: 6, title: 'Day 6', content: '', isRestDay: true },
                    { id: 7, title: 'Day 7', content: '', isRestDay: true }
                ]
            }
        ]
        // student_wangwu 没有计划（待制定）
    },

    // 学员执行记录数据
    // 键名对应 clients 中的学员ID
    clientExecution: {
        'student_liming': {
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
        },
        'student_maliu': {
            'week_1_day_1': {
                completed: true,
                date: '2023-11-18',
                feedback: '第一次训练，感觉还不错！',
                exercises: [
                    { 
                        name: '俯卧撑', 
                        planned: '3组 x 15次', 
                        actual: '3组 x 12次',
                        sets: [
                            { reps: 12, rpe: 8, rest: '90s' },
                            { reps: 12, rpe: 8.5, rest: '90s' },
                            { reps: 10, rpe: 9, rest: '90s', note: '最后一组有点累' }
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
    // 清除所有缓存数据，用于重置原型状态
    clear: () => {
        const keys = [
            'exercises', 'templates', 'users', 'session', 'coaches',
            'coachApplications', 'submissions', 'coachProfiles', 'coachPricing',
            'coachContent', 'subscriptions', 'subscriptionSettings',
            'messages', 'chatSessions', 'videos', 'clientPlans', 'clientExecution', 'studentProfiles'
        ];
        keys.forEach(key => localStorage.removeItem(`coachlink_${key}`));
    },
    init: () => {
        // 原型开发阶段：总是使用最新的 MockData 数据
        // 这样每次刷新页面都会使用代码中定义的最新数据
        Store.set('exercises', MockData.exercises);
        Store.set('templates', MockData.templates);
        Store.set('users', MockData.users);
        Store.set('coaches', MockData.coaches);
        Store.set('coachApplications', MockData.coachApplications);
        Store.set('submissions', MockData.submissions);
        Store.set('coachProfiles', MockData.coachProfiles);
        Store.set('coachPricing', MockData.coachPricing);
        Store.set('coachContent', MockData.coachContent);
        Store.set('subscriptions', MockData.subscriptions);
        Store.set('subscriptionSettings', MockData.subscriptionSettings);
        Store.set('messages', MockData.messages);
        Store.set('chatSessions', MockData.chatSessions);
        Store.set('videos', MockData.videos);
        Store.set('clientPlans', MockData.clientPlans);
        Store.set('clientExecution', MockData.clientExecution);
        Store.set('studentProfiles', MockData.studentProfiles);
        Store.set('clients', MockData.clients);  // 添加 clients 数据初始化
        
        // 只有 session 保持不变，这样登录状态可以持久化
        if (!localStorage.getItem('coachlink_session')) {
            Store.set('session', MockData.session);
        }
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
                id: 'student_maliu',
                name: '马六',
                roles: ['student'],
                avatar: '马'
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
