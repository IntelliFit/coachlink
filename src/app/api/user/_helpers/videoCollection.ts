import supabase from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';

type TrainingVideoRow = Database['public']['Tables']['training_videos']['Row'];
type ExecutionSetVideoRow = Database['public']['Tables']['execution_set_videos']['Row'];
type PlanInstanceExecutionRow = Database['public']['Tables']['plan_instance_executions']['Row'];

export async function getOwnedTrainingVideo(
    trainingVideoId: string,
    userId: string
): Promise<TrainingVideoRow | null> {
    const { data, error } = await supabase
        .from('training_videos')
        .select('id,user_id,video_url,thumbnail_url,file_size,duration_seconds,processing_status')
        .eq('id', trainingVideoId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) {
        throw new Error(`查询训练视频失败: ${error.message}`);
    }

    if (!data || data.user_id !== userId) {
        return null;
    }

    return data;
}

export async function getOwnedExecutionSetVideo(
    executionSetVideoId: string,
    userId: string
): Promise<ExecutionSetVideoRow & { execution?: PlanInstanceExecutionRow } | null> {
    const { data, error } = await supabase
        .from('execution_set_videos')
        .select('id,execution_id,video_url,thumbnail_url,duration_seconds,file_size,review_status,requires_review,exercise_name,storage_path,storage_bucket,execution:plan_instance_executions!inner(student_id)')
        .eq('id', executionSetVideoId)
        .maybeSingle();

    if (error) {
        throw new Error(`查询执行组视频失败: ${error.message}`);
    }

    if (!data || (data as any).execution?.student_id !== userId) {
        return null;
    }

    return data as ExecutionSetVideoRow & { execution?: PlanInstanceExecutionRow };
}

