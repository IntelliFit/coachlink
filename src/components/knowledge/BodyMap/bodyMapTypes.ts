// 由 compress-body-map.mjs 自动生成，请勿手动修改

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

const CATEGORY_DEFINITIONS = {
  胸部: ['胸大肌上部', '胸大肌中部', '胸大肌下部', '胸大肌'],
  肩部: ['三角肌前束', '三角肌中束', '三角肌后束', '三角肌', '肩关节'],
  大臂: ['肱二头肌', '肱三头肌'],
  前臂: ['肱桡肌', '肱侧腕屈肌', '腕关节'],
  腹部: ['腹直肌', '腹外直肌'],
  大腿: ['股直肌', '股四头肌', '股二头肌', '半腱肌', '内收肌', '髋关节'],
  小腿: ['腓肠肌', '比目鱼肌', '胫骨前肌', '踝关节', '膝关节'],
  臀部: ['臀大肌'],
  背部: ['斜方肌', '背阔肌', '竖脊肌', '大圆肌', '岗下肌'],
  关节: ['膝关节', '踝关节', '髋关节', '腕关节', '肩关节'],
} as const;

export type SvgBodyCategory = keyof typeof CATEGORY_DEFINITIONS;

export const SVG_BODY_CATEGORIES = Object.keys(CATEGORY_DEFINITIONS) as SvgBodyCategory[];

export const CATEGORY_TO_BODY_PARTS: Record<SvgBodyCategory, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_DEFINITIONS).map(([category, names]) => [category, [...names]]),
) as Record<SvgBodyCategory, string[]>;

export const BODY_PART_CATEGORY_MAP: Record<string, SvgBodyCategory> = Object.entries(
  CATEGORY_TO_BODY_PARTS,
).reduce((acc, [category, names]) => {
  names.forEach((name) => {
    acc[name] = category as SvgBodyCategory;
  });
  return acc;
}, {} as Record<string, SvgBodyCategory>);

export const SVG_BODY_PART_NAMES = Array.from(
  new Set(
    [
      ...Object.keys(BODY_PART_METADATA),
      ...Object.values(CATEGORY_TO_BODY_PARTS).flat(),
    ],
  ),
);

export function getCategory(name: string): SvgBodyCategory | null {
  return BODY_PART_CATEGORY_MAP[name] ?? null;
}

export function isJoint(name: string): boolean {
  return BODY_PART_METADATA[name]?.type === 'joint' || getCategory(name) === '关节';
}
