// 运动数据卡片类型定义 - 7 大类
// 所有字段均为选填

// 1. 力量举 (Powerlifting)
export interface PowerliftingData {
    squat: number | null; // 深蹲 1RM (kg)
    bench: number | null; // 卧推 1RM (kg)
    deadlift: number | null; // 硬拉 1RM (kg)
}

// 2. 街头力量举 (Streetlifting)
export interface StreetliftingData {
    weightedPullup: number | null; // 负重引体 1RM (kg)
    weightedDip: number | null; // 负重双杠 1RM (kg)
    weightedMuscleUp: number | null; // 负重双力臂 1RM (kg)
    squat: number | null; // 深蹲 1RM (kg)
}

// 3. 街头健身 (Calisthenics)
export interface CalisthenicsData {
    maxPullups: number | null; // 最大引体次数
    maxDips: number | null; // 最大双杠次数
    maxMuscleUps: number | null; // 最大双力臂次数
    frontLever: number | null; // 前水平 (秒)
    planche: number | null; // 俄式挺身 (秒)
    humanFlag: number | null; // 人体旗帜 (秒)
}

// 4. 举重 (Weightlifting - Olympic)
export interface WeightliftingData {
    snatch: number | null; // 抓举 1RM (kg)
    cleanAndJerk: number | null; // 挺举 1RM (kg)
}

// 5. 健美/形体 (Bodybuilding)
export interface BodybuildingData {
    weight: number | null; // 体重 (kg)
    bodyfat: number | null; // 体脂率 (%)
    chest: number | null; // 胸围 (cm)
    arm: number | null; // 臂围 (cm)
    waist: number | null; // 腰围 (cm)
    hip: number | null; // 臀围 (cm)
    thigh: number | null; // 大腿围 (cm)
    calf: number | null; // 小腿围 (cm)
}

// 6. 跑步 (Running)
export interface RunningData {
    fiveK: string | null; // 5公里用时 (mm:ss)
    tenK: string | null; // 10公里用时 (mm:ss)
    halfMarathon: string | null; // 半马用时 (hh:mm:ss)
    marathon: string | null; // 全马用时 (hh:mm:ss)
}

// 7. 骑行 (Cycling)
export interface CyclingData {
    ftp: number | null; // FTP功率 (W)
    maxPower: number | null; // 最大功率 (W)
    maxDistance: number | null; // 最长单次骑行 (km)
}

// 完整的运动数据卡片
export interface SportCards {
    activeCards: string[];
    powerlifting?: PowerliftingData;
    streetlifting?: StreetliftingData;
    calisthenics?: CalisthenicsData;
    weightlifting?: WeightliftingData;
    bodybuilding?: BodybuildingData;
    running?: RunningData;
    cycling?: CyclingData;
}

// 卡片类型配置
export interface CardTypeConfig {
    key: string;
    label: string;
    icon: string; // lucide icon name
    color: string; // tailwind color class
    borderColor: string;
    bgColor: string;
}

// 卡片类型列表
export const SPORT_CARD_TYPES: CardTypeConfig[] = [
    {
        key: "powerlifting",
        label: "力量举",
        icon: "Dumbbell",
        color: "text-orange-600",
        borderColor: "border-orange-200",
        bgColor: "bg-orange-50",
    },
    {
        key: "streetlifting",
        label: "街头力量举",
        icon: "Grip",
        color: "text-lime-600",
        borderColor: "border-lime-200",
        bgColor: "bg-lime-50",
    },
    {
        key: "calisthenics",
        label: "街头健身",
        icon: "PersonStanding",
        color: "text-green-600",
        borderColor: "border-green-200",
        bgColor: "bg-green-50",
    },
    {
        key: "weightlifting",
        label: "举重",
        icon: "Weight",
        color: "text-red-600",
        borderColor: "border-red-200",
        bgColor: "bg-red-50",
    },
    {
        key: "bodybuilding",
        label: "健美/形体",
        icon: "User",
        color: "text-purple-600",
        borderColor: "border-purple-200",
        bgColor: "bg-purple-50",
    },
    {
        key: "running",
        label: "跑步",
        icon: "Footprints",
        color: "text-blue-600",
        borderColor: "border-blue-200",
        bgColor: "bg-blue-50",
    },
    {
        key: "cycling",
        label: "骑行",
        icon: "Bike",
        color: "text-cyan-600",
        borderColor: "border-cyan-200",
        bgColor: "bg-cyan-50",
    },
];

// 获取空的运动卡片数据
export function getEmptySportCards(): SportCards {
    return {
        activeCards: [],
        powerlifting: { squat: null, bench: null, deadlift: null },
        streetlifting: {
            weightedPullup: null,
            weightedDip: null,
            weightedMuscleUp: null,
            squat: null,
        },
        calisthenics: {
            maxPullups: null,
            maxDips: null,
            maxMuscleUps: null,
            frontLever: null,
            planche: null,
            humanFlag: null,
        },
        weightlifting: { snatch: null, cleanAndJerk: null },
        bodybuilding: {
            weight: null,
            bodyfat: null,
            chest: null,
            arm: null,
            waist: null,
            hip: null,
            thigh: null,
            calf: null,
        },
        running: {
            fiveK: null,
            tenK: null,
            halfMarathon: null,
            marathon: null,
        },
        cycling: { ftp: null, maxPower: null, maxDistance: null },
    };
}

// 计算力量举总成绩
export function getPowerliftingTotal(data?: PowerliftingData | null): number {
    if (!data) return 0;
    return (data.squat || 0) + (data.bench || 0) + (data.deadlift || 0);
}

// 计算街头力量举总成绩
export function getStreetliftingTotal(data?: StreetliftingData | null): number {
    if (!data) return 0;
    return (data.weightedPullup || 0) + (data.weightedDip || 0);
}

// 计算举重总成绩
export function getWeightliftingTotal(data?: WeightliftingData | null): number {
    if (!data) return 0;
    return (data.snatch || 0) + (data.cleanAndJerk || 0);
}
