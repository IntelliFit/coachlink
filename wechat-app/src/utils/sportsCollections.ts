// 运动卡片相关的工具函数和类型定义

export interface SportCards {
  activeCards: string[]
  powerlifting?: {
    squat: number | null
    bench: number | null
    deadlift: number | null
  }
  streetlifting?: {
    weightedPullup: number | null
    weightedDip: number | null
    weightedMuscleUp: number | null
    squat: number | null
  }
  calisthenics?: {
    maxPullups: number | null
    maxDips: number | null
    maxMuscleUps: number | null
    frontLever: number | null
    planche: number | null
    humanFlag: number | null
  }
  weightlifting?: {
    snatch: number | null
    cleanAndJerk: number | null
  }
  bodybuilding?: {
    weight: number | null
    bodyfat: number | null
    chest: number | null
    arm: number | null
    waist: number | null
    hip: number | null
    thigh: number | null
    calf: number | null
  }
  running?: {
    fiveK: number | null
    tenK: number | null
    halfMarathon: number | null
    marathon: number | null
  }
  cycling?: {
    ftp: number | null
    maxPower: number | null
    maxDistance: number | null
  }
}

export interface FieldLabelEntry {
  name: string
  nameCn: string
  unit: string
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
}

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
  }
}

export function showTotalWeight(sportType: string) {
  return sportType === 'powerlifting' || sportType === 'weightlifting' || sportType === 'streetlifting'
}

export function getTotalWeight(sportType: string, sportData: any): number {
  if (sportType === 'powerlifting') {
    return (sportData?.squat || 0) + (sportData?.bench || 0) + (sportData?.deadlift || 0)
  } else if (sportType === 'weightlifting') {
    return (sportData?.snatch || 0) + (sportData?.cleanAndJerk || 0)
  } else if (sportType === 'streetlifting') {
    return (sportData?.weightedPullup || 0) + (sportData?.weightedDip || 0)
  }
  return 0
}
