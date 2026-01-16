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
