import type { AiNavigatorResult } from '@coachlink/core'
import { request } from '@/utils/request'

const AI_NAVIGATOR_ENDPOINT = '/api/miniapp/ai-navigator'

export const aiNavigatorService = {
  recognizeIntent(query: string) {
    return request<AiNavigatorResult>({
      url: AI_NAVIGATOR_ENDPOINT,
      method: 'POST',
      data: { query },
      showErrorToast: false,
    })
  },
}
