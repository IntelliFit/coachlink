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
        // Always update these for development/testing of new features
        Store.set('clientPlans', MockData.clientPlans);
        Store.set('clientExecution', MockData.clientExecution);
    }
};

// Initialize on load
Store.init();
