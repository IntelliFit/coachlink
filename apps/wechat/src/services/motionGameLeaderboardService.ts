import Taro from '@tarojs/taro'
import { BaseService } from '@/utils/request'

export type MotionGameKey = 'pullup-rush' | 'pushup-dash'

export const MOTION_GAME_TEMPLATE_IDS: Record<MotionGameKey, string> = {
  'pullup-rush': 'b7bc1548-08ed-4f52-90cc-f5b22a785101',
  'pushup-dash': 'b7bc1548-08ed-4f52-90cc-f5b22a785102'
}

export type MotionGameSession = {
  sessionId: string
  startedAt: string
  bestScore: number
  templateId: string
  rankingPath: string
}

export type MotionGameRankingResult = {
  isPersonalBest: boolean
  rank: number
  total: number
  percentile: number
  bestScore: number
  bestElapsedMs: number
  bestActionCount: number
  templateId: string
  rankingPath: string
}

function getClientVersion() {
  try {
    const account = Taro.getAccountInfoSync()
    return [account?.miniProgram?.version, account?.miniProgram?.envVersion]
      .filter(Boolean)
      .join(' / ')
  } catch {
    return ''
  }
}

class MotionGameLeaderboardService extends BaseService {
  async startSession(gameKey: MotionGameKey): Promise<MotionGameSession | null> {
    const response = await this.post<MotionGameSession>('start', {
      gameKey,
      clientVersion: getClientVersion()
    }, { showErrorToast: false })
    return response.success && response.data ? response.data : null
  }

  async finishSession(params: {
    sessionId: string
    gameKey: MotionGameKey
    score: number
    elapsedMs: number
    actionCount: number
    lockRatio: number
  }): Promise<MotionGameRankingResult | null> {
    const response = await this.post<MotionGameRankingResult>('finish', params, {
      showErrorToast: false
    })
    return response.success && response.data ? response.data : null
  }
}

export const motionGameLeaderboardService = new MotionGameLeaderboardService(
  '/api/toolbox/motion-games/session'
)
