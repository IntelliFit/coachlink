/**
 * Leaderboard Configuration
 * 排行榜配置文件 - 通过修改此文件即可添加新的排行榜项目
 */

const LEADERBOARD_CONFIG = {
    'pullup_weighted': {
        id: 'pullup_weighted',
        title: '负重引体',
        icon: 'Dumbbell',
        description: '展示你的上肢力量，挑战最大负重引体向上',
        type: 'weight',
        unit: 'kg',
        sortField: 'totalWeight',
        hasVariants: true,
        variants: {
            'strict': {
                id: 'strict',
                name: '赛拉式',
                description: '【赛拉式标准】下巴过杠，手臂完全伸直，身体无借力摆动。这是对绝对力量的终极考验。'
            },
            'loose': {
                id: 'loose',
                name: '非赛拉式',
                description: '【非赛拉式标准】允许适度借力，下巴过杠即可。适合挑战极限重量。'
            }
        },
        formFields: [
            { name: 'weight', label: '负重重量 (kg)', type: 'number', required: true, min: 0, step: 0.5 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'reps', label: '完成次数', type: 'number', required: true, min: 1, step: 1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true },
            { name: 'variant', label: '榜单类型', type: 'select', required: true, options: [
                { value: 'strict', label: '赛拉式' },
                { value: 'loose', label: '非赛拉式' }
            ]}
        ],
        calculateScore: (data) => {
            return parseFloat(data.bodyweight) + parseFloat(data.weight);
        }
    },
    'pullup_bodyweight': {
        id: 'pullup_bodyweight',
        title: '自重引体',
        icon: 'Activity',
        description: '比拼引体向上最大次数，耐力与意志的较量',
        type: 'reps',
        unit: '次',
        sortField: 'reps',
        formFields: [
            { name: 'reps', label: '完成次数', type: 'number', required: true, min: 1, step: 1 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true }
        ],
        calculateScore: (data) => {
            return parseInt(data.reps);
        }
    },
    'squat': {
        id: 'squat',
        title: '深蹲',
        icon: 'TrendingDown',
        description: '下肢力量之王，挑战最大深蹲重量',
        type: 'weight',
        unit: 'kg',
        sortField: 'weight',
        formFields: [
            { name: 'weight', label: '深蹲重量 (kg)', type: 'number', required: true, min: 20, step: 2.5 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true }
        ],
        calculateScore: (data) => {
            return parseFloat(data.weight);
        }
    },
    'bench_press': {
        id: 'bench_press',
        title: '卧推',
        icon: 'Maximize2',
        description: '上肢推力的终极考验',
        type: 'weight',
        unit: 'kg',
        sortField: 'weight',
        hasVariants: true,
        variants: {
            'competition': {
                id: 'competition',
                name: '赛推',
                description: '【赛推标准】必须有明显的停顿，听从裁判口令，臀部不离凳。'
            },
            'regular': {
                id: 'regular',
                name: '非赛推',
                description: '【非赛推标准】触胸即推，允许适度起桥，但臀部不可离凳。'
            }
        },
        formFields: [
            { name: 'weight', label: '卧推重量 (kg)', type: 'number', required: true, min: 20, step: 2.5 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true },
            { name: 'variant', label: '榜单类型', type: 'select', required: true, options: [
                { value: 'competition', label: '赛推' },
                { value: 'regular', label: '非赛推' }
            ]}
        ],
        calculateScore: (data) => {
            return parseFloat(data.weight);
        }
    },
    'deadlift': {
        id: 'deadlift',
        title: '硬拉',
        icon: 'ArrowUp',
        description: '全身力量的综合体现，挑战人类极限',
        type: 'weight',
        unit: 'kg',
        sortField: 'weight',
        formFields: [
            { name: 'weight', label: '硬拉重量 (kg)', type: 'number', required: true, min: 20, step: 2.5 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true }
        ],
        calculateScore: (data) => {
            return parseFloat(data.weight);
        }
    },
    'muscle_up': {
        id: 'muscle_up',
        title: '负重双力臂',
        icon: 'Zap',
        description: '上肢爆发力与协调性的巅峰挑战',
        type: 'weight',
        unit: 'kg',
        sortField: 'totalWeight',
        formFields: [
            { name: 'weight', label: '负重重量 (kg)', type: 'number', required: true, min: 0, step: 0.5 },
            { name: 'bodyweight', label: '体重 (kg)', type: 'number', required: true, min: 30, step: 0.1 },
            { name: 'reps', label: '完成次数', type: 'number', required: true, min: 1, step: 1 },
            { name: 'videoUrl', label: '训练视频链接', type: 'url', required: true }
        ],
        calculateScore: (data) => {
            return parseFloat(data.bodyweight) + parseFloat(data.weight);
        }
    }
};

// Helper function to get leaderboard config by ID
function getLeaderboardConfig(leaderboardId) {
    return LEADERBOARD_CONFIG[leaderboardId];
}

// Get list of all leaderboards
function getAllLeaderboards() {
    return Object.values(LEADERBOARD_CONFIG);
}
