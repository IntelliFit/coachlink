import { NextResponse } from 'next/server'
import supabase from '@/lib/supabaseClient'
import type { ApiData } from '@/types/api'

interface PublicCoachReview {
  id: string
  studentId: string
  studentName: string
  studentAvatarUrl: string | null
  comment: string
  rating: number | null
  createdAt: string | null
}

interface GetPublicReviewsResponseDto {
  reviews: PublicCoachReview[]
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { coachId?: unknown } | null
  const coachId = typeof body?.coachId === 'string' ? body.coachId.trim() : ''

  if (!coachId) {
    return NextResponse.json<ApiData<GetPublicReviewsResponseDto>>({
      success: false,
      message: '缺少 coachId',
      data: null
    }, { status: 400 })
  }

  const { data: comments, error: commentsError } = await supabase
    .from('student_comments')
    .select('id, student_id, comment, rating, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (commentsError) {
    return NextResponse.json<ApiData<GetPublicReviewsResponseDto>>({
      success: false,
      message: '获取学员评价失败',
      data: null
    }, { status: 500 })
  }

  const studentIds = Array.from(new Set((comments || []).map((comment) => comment.student_id).filter(Boolean)))
  const profileByStudentId = new Map<string, { nickname: string | null; full_name: string | null; avatar_url: string | null }>()

  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, nickname, full_name, avatar_url')
      .in('user_id', studentIds)

    for (const profile of profiles || []) {
      if (profile.user_id) {
        profileByStudentId.set(profile.user_id, profile)
      }
    }
  }

  const reviews: PublicCoachReview[] = (comments || []).map((comment) => {
    const profile = profileByStudentId.get(comment.student_id)
    return {
      id: comment.id,
      studentId: comment.student_id,
      studentName: profile?.nickname || profile?.full_name || '学员',
      studentAvatarUrl: profile?.avatar_url || null,
      comment: comment.comment || '',
      rating: comment.rating,
      createdAt: comment.created_at
    }
  })

  return NextResponse.json<ApiData<GetPublicReviewsResponseDto>>({
    success: true,
    message: '获取学员评价成功',
    data: { reviews }
  })
}
