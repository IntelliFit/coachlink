/**
 * 动作库常量定义（从 pages/action-lib 迁移）
 */

export const ITEMS_PER_PAGE = 12

export const TYPE_META: Record<string, { label: string; className: string }> = {
  STRENGTH: { label: '力量', className: 'tag-strength' },
  DIET: { label: '饮食', className: 'tag-diet' },
  CARDIO: { label: '有氧', className: 'tag-cardio' },
  HABIT: { label: '习惯', className: 'tag-habit' }
}
