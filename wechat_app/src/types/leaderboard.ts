export interface LeaderboardNumberInput {
  type: 'number'
  name: string
  required?: boolean
  userInput?: number
}

export interface LeaderboardTextInput {
  type: 'text'
  name: string
  required?: boolean
  userInput?: string
}

export interface LeaderboardOptionInput {
  type: 'option'
  name: string
  options: string[]
  required?: boolean
  userInput?: string
}

export interface LeaderboardVideoInput {
  type: 'video'
  name: string
  userInput: string
}

export type LeaderboardFormInput =
  | LeaderboardNumberInput
  | LeaderboardTextInput
  | LeaderboardOptionInput
  | LeaderboardVideoInput

export interface LeaderboardRule {
  detail: string
  status: 'success' | 'warning' | 'error'
}

export interface ListLeaderboardItem {
  id: string
  title: string
  description: string | null
  start_at: string | null
  end_at: string | null
  rank_by_field: string
  sort_order: string | null
  type: string | null
  remarks: string | null
  created_at: string | null
  creator_id: string | null
  statusCount?: number
}

export interface LeaderboardEntryWithProfile {
  id: string
  template_id: string
  user_id: string
  score: number | null
  status: string
  form_data: unknown
  evidence_url: string | null
  extra_data?: Record<string, unknown>
  created_at: string
  userProfile: {
    name: string
    avatar: string
  }
}
