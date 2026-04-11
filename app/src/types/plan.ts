import type { ItemType } from './action'

export type PlanItemType = ItemType
export type PlanDayType = 'training' | 'rest'

export interface PlanActionOption {
  id: string
  name: string
  type?: string | null
  attrs?: string[] | null
  enableAutoWeightCompute?: boolean | null
  includesBodyWeight?: boolean | null
  canonical_action_id?: string | null
}

export interface PlanQuestionOption {
  label?: string
  value?: string | number
  text?: string
}

export interface PlanQuestionItem {
  id?: string
  question?: string
  options?: PlanQuestionOption[] | string[]
  type?: string
}

export interface PlanActionSet {
  type?: 'no-filter' | 'one-filter' | string
  itemType?: PlanItemType | string
  actionId?: string
  action_id?: string
  actionName?: string
  action_name?: string
  setName?: string
  set_name?: string
  group_title?: string
  note?: string
  question?: {
    question?: string
    options?: PlanQuestionOption[]
  }
  actions?: PlanActionSet[]
  params?: Record<string, any>
  [key: string]: any
}

export interface PlanTrainingDay {
  dayIndex: number
  type: PlanDayType
  note?: string
  actionSets: PlanActionSet[]
  actionSetsCount?: number
  [key: string]: any
}

export interface PlanEditorValue {
  name: string
  description: string
  tags: string[]
  suitableFor: 'beginner' | 'intermediate' | 'advanced'
  type?: string | null
  weekDays: number[]
  globalAnswers: Record<string, number>
  days: PlanTrainingDay[]
  oneRMConfig: Record<string, number>
}
