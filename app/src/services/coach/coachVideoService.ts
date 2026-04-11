import { BaseService } from '../../utils/request'

export interface ExecutionSetVideoWithDetails {
  id: string
  video_url?: string | null
  student_name?: string
  student_id?: string
  exercise_name?: string | null
  review_status?: 'pending' | 'reviewed' | 'not_required'
  [key: string]: any
}

class CoachVideoService extends BaseService {
  /**
   * 获取待点评视频列表（execution_set_videos）
   */
  async getExecutionSetVideos(params: {
    pagination?: { page: number; limit: number }
    reviewStatus?: 'pending' | 'reviewed' | ''
  }) {
    const res = await this.post<{ videos: ExecutionSetVideoWithDetails[]; total: number }>(
      'execution-videos-pending',
      {
        pagination: params.pagination || { page: 1, limit: 100 },
        reviewStatus: params.reviewStatus === '' ? undefined : (params.reviewStatus || undefined)
      }
    )
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 教练点评视频
   */
  async reviewExecutionVideo(
    videoId: string,
    feedback: { rating?: number; comment?: string; tips?: string[] }
  ) {
    const res = await this.post<{ id: string }>('execution-review', { videoId, feedback })
    if (res.success && res.data) return res.data
    return null
  }
}

export const coachVideoService = new CoachVideoService('/api/coach/video')
