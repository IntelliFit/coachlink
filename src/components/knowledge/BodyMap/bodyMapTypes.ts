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
