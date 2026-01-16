import { PowerliftingData, SportCards, StreetliftingData, WeightliftingData } from "@/types/sportCards";
import { Bike, Dumbbell, Footprints, User } from "lucide-react";

interface FieldLabelEntry {
    name: string;
    nameCn: string;
    unit: string;
}

export const typicalActionMaps: Record<string, FieldLabelEntry> = {
    // 力量 / 举重 / 街力
    squat: { name: 'squat', nameCn: '深蹲', unit: 'kg' },
    bench: { name: 'bench', nameCn: '卧推', unit: 'kg' },
    deadlift: { name: 'deadlift', nameCn: '硬拉', unit: 'kg' },
    weightedPullup: { name: 'weightedPullup', nameCn: '负重引体', unit: 'kg' },
    weightedDip: { name: 'weightedDip', nameCn: '负重双杠', unit: 'kg' },
    weightedMuscleUp: { name: 'weightedMuscleUp', nameCn: '负重暴力上杠', unit: 'kg' },
    snatch: { name: 'snatch', nameCn: '抓举', unit: 'kg' },
    cleanAndJerk: { name: 'cleanAndJerk', nameCn: '挺举', unit: 'kg' },
    // 街健
    maxPullups: { name: 'maxPullups', nameCn: '极限引体', unit: 'rep' },
    maxDips: { name: 'maxDips', nameCn: '极限双杠', unit: 'rep' },
    maxMuscleUps: { name: 'maxMuscleUps', nameCn: '极限暴力上杠', unit: 'rep' },
    frontLever: { name: 'frontLever', nameCn: '前水平', unit: 'sec' },
    planche: { name: 'planche', nameCn: '俄式挺身', unit: 'sec' },
    humanFlag: { name: 'humanFlag', nameCn: '顺风旗', unit: 'sec' },
    // 健美/形体
    weight: { name: 'weight', nameCn: '体重', unit: 'kg' },
    bodyfat: { name: 'bodyfat', nameCn: '体脂率', unit: '%' },
    chest: { name: 'chest', nameCn: '胸围', unit: 'cm' },
    arm: { name: 'arm', nameCn: '臂围', unit: 'cm' },
    waist: { name: 'waist', nameCn: '腰围', unit: 'cm' },
    hip: { name: 'hip', nameCn: '臀围', unit: 'cm' },
    thigh: { name: 'thigh', nameCn: '大腿围', unit: 'cm' },
    calf: { name: 'calf', nameCn: '小腿围', unit: 'cm' },
    // 跑步 - 时间单位为秒
    fiveK: { name: 'fiveK', nameCn: '5公里', unit: 'sec' },
    tenK: { name: 'tenK', nameCn: '10公里', unit: 'sec' },
    halfMarathon: { name: 'halfMarathon', nameCn: '半程马拉松', unit: 'sec' },
    marathon: { name: 'marathon', nameCn: '全程马拉松', unit: 'sec' },
    // 骑行
    ftp: { name: 'ftp', nameCn: '功能阈值功率', unit: 'w' },
    maxPower: { name: 'maxPower', nameCn: '峰值功率', unit: 'w' },
    maxDistance: { name: 'maxDistance', nameCn: '最长里程', unit: 'km' }
};

export const SportTypes = [
    { key: 'powerlifting', label: '力量举', icon: Dumbbell, color: 'text-primary-500', bg: 'bg-primary-50/50', border: 'border-primary-100', active: 'border-primary-500 ring-4 ring-primary-500/10' },
    { key: 'streetlifting', label: '街头力量', icon: Dumbbell, color: 'text-lime-600', bg: 'bg-lime-50/50', border: 'border-lime-100', active: 'border-lime-500 ring-4 ring-lime-500/10' },
    { key: 'calisthenics', label: '街头健身', icon: User, color: 'text-green-600', bg: 'bg-green-50/50', border: 'border-green-100', active: 'border-green-500 ring-4 ring-green-500/10' },
    { key: 'weightlifting', label: '举重', icon: Dumbbell, color: 'text-red-600', bg: 'bg-red-50/50', border: 'border-red-100', active: 'border-red-500 ring-4 ring-red-500/10' },
    { key: 'bodybuilding', label: '健美/形体', icon: User, color: 'text-purple-600', bg: 'bg-purple-50/50', border: 'border-purple-100', active: 'border-purple-500 ring-4 ring-purple-500/10' },
    { key: 'running', label: '跑步', icon: Footprints, color: 'text-blue-600', bg: 'bg-blue-50/50', border: 'border-blue-100', active: 'border-blue-500 ring-4 ring-blue-500/10' },
    { key: 'cycling', label: '骑行', icon: Bike, color: 'text-cyan-600', bg: 'bg-cyan-50/50', border: 'border-cyan-100', active: 'border-cyan-500 ring-4 ring-cyan-500/10' },
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

export function showTotalWeight(sportType: string) {
    return sportType === 'powerlifting' || sportType === 'weightlifting' || sportType === 'streetlifting';
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

export function getTotalWeight(sportType: string, sportData: any): number {
    return sportType === 'powerlifting' ? getPowerliftingTotal(sportData) :
        sportType === 'weightlifting' ? getWeightliftingTotal(sportData) :
            getStreetliftingTotal(sportData)
}