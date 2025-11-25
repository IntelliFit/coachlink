import supabase from '@/lib/supabaseClient';
import type { VideoUploadContext, ReviewStatus } from '@/types/video';
import type { Database } from '@/types/database.types';

type TrainingVideoRow = Database['public']['Tables']['training_videos']['Row'];

type SubmissionSource = 'file_upload' | 'url_submission';

interface CreateTrainingVideoRecordParams {
    userId: string;
    videoUrl: string;
    context: VideoUploadContext;
    submissionSource: SubmissionSource;
    fileSize?: number;
    durationSeconds?: number;
    thumbnailUrl?: string;
    metadata?: Record<string, any>;
    processingStatus?: string;
}

export async function createTrainingVideoRecord({
    userId,
    videoUrl,
    context,
    submissionSource,
    fileSize,
    durationSeconds,
    thumbnailUrl,
    metadata = {},
    processingStatus = 'ready'
}: CreateTrainingVideoRecordParams): Promise<TrainingVideoRow> {
    const studentName = await getStudentDisplayName(userId);
    const coachId = await resolveCoachId(userId, context.coach_id);

    const mergedMetadata = {
        storage_folder: userId || 'anonymous',
        student_name: studentName || (context as any).student_name || null,
        submission_source: submissionSource,
        ...metadata,
    };

    const reviewStatus: ReviewStatus =
        context.requires_review === false ? 'not_required' : 'pending';

    const { data, error } = await supabase
        .from('training_videos')
        .insert({
            user_id: userId,
            coach_id: coachId,
            type: context.type,
            training_plan_id: context.training_plan_id ?? null,
            training_session_id: context.training_session_id ?? null,
            exercise_name: context.exercise_name ?? null,
            week_number: context.week_number ?? null,
            day_of_week: context.day_of_week ?? null,
            video_url: videoUrl,
            requires_review: context.requires_review ?? true,
            review_status: reviewStatus,
            user_notes: context.user_notes ?? null,
            processing_status: processingStatus,
            tags: [],
            metadata: mergedMetadata,
            file_size: fileSize ?? null,
            duration_seconds: durationSeconds ?? null,
            thumbnail_url: thumbnailUrl ?? null,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`数据库记录创建失败: ${error?.message || 'unknown error'}`);
    }

    return data;
}

async function getStudentDisplayName(userId: string): Promise<string | null> {
    if (!userId) return null;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, nickname')
        .eq('user_id', userId)
        .maybeSingle();

    return profile?.full_name || profile?.nickname || null;
}

async function resolveCoachId(
    userId: string,
    contextCoachId?: string
): Promise<string | null> {
    // 1) active subscription
    const { data: subscriptionCoach } = await supabase
        .from('coach_subscriptions')
        .select('coach_id')
        .eq('student_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const subscriptionCoachId = subscriptionCoach?.coach_id;
    if (subscriptionCoachId) {
        const approved = await getApprovedCoachId(subscriptionCoachId);
        if (approved) {
            return approved;
        }
    }

    if (!contextCoachId) {
        return null;
    }

    const approvedFromContext = await getApprovedCoachId(contextCoachId);
    if (approvedFromContext) {
        return approvedFromContext;
    }

    const { data: coachByUser } = await supabase
        .from('coaches')
        .select('id, status')
        .eq('user_id', contextCoachId)
        .maybeSingle();

    if (coachByUser?.id && coachByUser.status === 'approved') {
        return coachByUser.id;
    }

    return null;
}

async function getApprovedCoachId(candidateId: string): Promise<string | null> {
    const { data: coach } = await supabase
        .from('coaches')
        .select('id, status')
        .eq('id', candidateId)
        .maybeSingle();

    if (coach?.id && coach.status === 'approved') {
        return coach.id;
    }

    return null;
}


