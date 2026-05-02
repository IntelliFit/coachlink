// 由 compress-body-map.mjs 自动生成，请勿手动修改
// 新增：基于 SVG data-name/category 的分类映射

export type BodyMuscle =
  | '斜方肌'
  | '三角肌'
  | '胸大肌'
  | '腹直肌'
  | '肱二头肌'
  | '肱桡肌'
  | '肱侧腕屈肌'
  | '腹外直肌'
  | '内收肌'
  | '股四头肌'
  | '腓肠肌'
  | '胫骨前肌'
  | '比目鱼肌'
  | '半腱肌'
  | '股二头肌'
  | '臀大肌'
  | '竖脊肌'
  | '背阔肌'
  | '肱三头肌'
  | '大圆肌'
  | '岗下肌';

export type BodyJoint =
  | '膝关节'
  | '踝关节'
  | '髋关节'
  | '腕关节'
  | '肩关节';

export type BodyPart = BodyMuscle | BodyJoint;

export const FRONT_MUSCLES = ['斜方肌', '三角肌', '胸大肌', '腹直肌', '肱二头肌', '肱桡肌', '肱侧腕屈肌', '腹外直肌', '内收肌', '股四头肌', '腓肠肌', '胫骨前肌'] as const;
export const FRONT_JOINTS = ['膝关节', '踝关节', '髋关节', '腕关节', '肩关节'] as const;
export const BACK_MUSCLES = ['比目鱼肌', '腓肠肌', '半腱肌', '股二头肌', '臀大肌', '竖脊肌', '肱桡肌', '肱侧腕屈肌', '背阔肌', '肱三头肌', '斜方肌', '大圆肌', '岗下肌', '三角肌'] as const;
export const BACK_JOINTS = ['踝关节', '膝关节', '髋关节', '腕关节', '肩关节'] as const;

export interface BodyPartMetadata {
  name: string;
  type: 'muscle' | 'joint';
  view: 'front' | 'back' | 'both';
  description?: string;
}

export const BODY_PART_METADATA: Record<string, BodyPartMetadata> = {
  '斜方肌': { name: '斜方肌', type: 'muscle', view: 'both' },
  '三角肌': { name: '三角肌', type: 'muscle', view: 'both' },
  '胸大肌': { name: '胸大肌', type: 'muscle', view: 'front' },
  '腹直肌': { name: '腹直肌', type: 'muscle', view: 'front' },
  '肱二头肌': { name: '肱二头肌', type: 'muscle', view: 'front' },
  '肱桡肌': { name: '肱桡肌', type: 'muscle', view: 'both' },
  '肱侧腕屈肌': { name: '肱侧腕屈肌', type: 'muscle', view: 'both' },
  '腹外直肌': { name: '腹外直肌', type: 'muscle', view: 'front' },
  '内收肌': { name: '内收肌', type: 'muscle', view: 'front' },
  '股四头肌': { name: '股四头肌', type: 'muscle', view: 'front' },
  '腓肠肌': { name: '腓肠肌', type: 'muscle', view: 'both' },
  '胫骨前肌': { name: '胫骨前肌', type: 'muscle', view: 'front' },
  '比目鱼肌': { name: '比目鱼肌', type: 'muscle', view: 'back' },
  '半腱肌': { name: '半腱肌', type: 'muscle', view: 'back' },
  '股二头肌': { name: '股二头肌', type: 'muscle', view: 'back' },
  '臀大肌': { name: '臀大肌', type: 'muscle', view: 'back' },
  '竖脊肌': { name: '竖脊肌', type: 'muscle', view: 'back' },
  '背阔肌': { name: '背阔肌', type: 'muscle', view: 'back' },
  '肱三头肌': { name: '肱三头肌', type: 'muscle', view: 'back' },
  '大圆肌': { name: '大圆肌', type: 'muscle', view: 'back' },
  '岗下肌': { name: '岗下肌', type: 'muscle', view: 'back' },
  '膝关节': { name: '膝关节', type: 'joint', view: 'both' },
  '踝关节': { name: '踝关节', type: 'joint', view: 'both' },
  '髋关节': { name: '髋关节', type: 'joint', view: 'both' },
  '腕关节': { name: '腕关节', type: 'joint', view: 'both' },
  '肩关节': { name: '肩关节', type: 'joint', view: 'both' }
};

// ============================================
// SVG data-name -> category 映射（新增）
// ============================================

export const BODY_PART_CATEGORY_MAP: Record<string, string> = {
  '三角肌中束': '肩部',
  '三角肌前束': '肩部',
  '三角肌后束': '肩部',
  '前臂伸肌': '小臂',
  '前臂屈肌': '小臂',
  '半腱肌': '大腿',
  '大圆肌': '背部',
  '斜方肌': '背部',
  '比目鱼肌': '小腿',
  '竖脊肌': '背部',
  '股二头肌': '大腿',
  '股内侧肌': '大腿',
  '股外侧肌': '大腿',
  '股直肌': '大腿',
  '肱三头肌': '大臂',
  '肱二头肌': '大臂',
  '肱桡肌': '小臂',
  '肱肌': '大臂',
  '背阔肌': '背部',
  '胫骨前肌': '小腿',
  '胸大肌上部': '胸部',
  '胸大肌下部': '胸部',
  '胸大肌中部': '胸部',
  '腓肠肌': '小腿',
  '腓肠肌内侧': '小腿',
  '腓肠肌外侧': '小腿',
  '腕关节': '关节',
  '腹外斜肌': '腹部',
  '腹外直肌': '腹部',
  '腹直肌上段': '腹部',
  '腹直肌下段': '腹部',
  '膝关节': '关节',
  '臀中肌/髋外展': '臀部',
  '臀大肌': '臀部',
  '踝关节': '关节',
};

export const CATEGORY_TO_BODY_PARTS: Record<string, string[]> = {
  '关节': ['腕关节', '膝关节', '踝关节'],
  '大腿': ['半腱肌', '股二头肌', '股内侧肌', '股外侧肌', '股直肌'],
  '大臂': ['肱二头肌', '肱肌', '肱三头肌'],
  '小腿': ['比目鱼肌', '胫骨前肌', '腓肠肌', '腓肠肌内侧', '腓肠肌外侧'],
  '小臂': ['前臂伸肌', '前臂屈肌', '肱桡肌'],
  '肩部': ['三角肌中束', '三角肌前束', '三角肌后束'],
  '背部': ['大圆肌', '斜方肌', '竖脊肌', '背阔肌'],
  '胸部': ['胸大肌上部', '胸大肌下部', '胸大肌中部'],
  '腹部': ['腹外斜肌', '腹外直肌', '腹直肌上段', '腹直肌下段'],
  '臀部': ['臀中肌/髋外展', '臀大肌'],
};

/** 所有来自 SVG 的专业名称（data-name） */
export const SVG_BODY_PART_NAMES = Object.keys(BODY_PART_CATEGORY_MAP);

/** 所有来自 SVG 的品类名称（category） */
export const SVG_BODY_CATEGORIES = Object.keys(CATEGORY_TO_BODY_PARTS);

/** 判断一个名称是否为关节 */
export function isJoint(name: string): boolean {
  return BODY_PART_CATEGORY_MAP[name] === '关节';
}

/** 获取名称的品类（category），兼容旧版名称 */
export function getCategory(name: string): string | null {
  if (BODY_PART_CATEGORY_MAP[name]) {
    return BODY_PART_CATEGORY_MAP[name];
  }
  // 旧版兼容映射
  const legacyMap: Record<string, string> = {
    '斜方肌': '背部',
    '三角肌': '肩部',
    '胸大肌': '胸部',
    '腹直肌': '腹部',
    '肱二头肌': '大臂',
    '肱桡肌': '小臂',
    '肱侧腕屈肌': '小臂',
    '腹外直肌': '腹部',
    '内收肌': '大腿',
    '股四头肌': '大腿',
    '腓肠肌': '小腿',
    '胫骨前肌': '小腿',
    '比目鱼肌': '小腿',
    '半腱肌': '大腿',
    '股二头肌': '大腿',
    '臀大肌': '臀部',
    '竖脊肌': '背部',
    '背阔肌': '背部',
    '肱三头肌': '大臂',
    '大圆肌': '背部',
    '岗下肌': '背部',
    '膝关节': '关节',
    '踝关节': '关节',
    '髋关节': '关节',
    '腕关节': '关节',
    '肩关节': '关节',
  };
  return legacyMap[name] || null;
}
