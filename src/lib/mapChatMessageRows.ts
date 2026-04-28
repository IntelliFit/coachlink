import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { MessageItem } from "@/app/api/chat/list-messages/entity";
import type { VideoReferenceItem } from "@/app/api/chat/send-message/entity";

type ChatMessageRow = {
    id: string;
    sender_id: string;
    message_type: string;
    content: string | null;
    media_url: string | null;
    file_name: string | null;
    file_size: number | null;
    duration: number | null;
    is_read: boolean;
    created_at: string;
    content_metadata?: unknown;
};

function findMatchingActionExecution(actionExecutions: unknown, actionId: string) {
    if (!Array.isArray(actionExecutions)) return null;

    return actionExecutions.find((actionExecution: any) => (
        actionExecution?.id === actionId || actionExecution?.action_id === actionId
    )) ?? null;
}

function findMatchingSetExecution(sets: unknown, setNumber: number) {
    if (!Array.isArray(sets)) return null;

    return sets.find((setExecution: any, index: number) => (
        setExecution?.set_number === setNumber ||
        setExecution?.setNumber === setNumber ||
        index === Math.max(0, setNumber - 1)
    )) ?? null;
}

function pickSetValue(setExecution: any, ...keys: string[]) {
    for (const key of keys) {
        const value = setExecution?.[key];
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return null;
}

async function refreshVideoReferences(
    rows: ChatMessageRow[],
): Promise<Map<string, VideoReferenceItem[]>> {
    const messageToRefs = new Map<string, VideoReferenceItem[]>();
    const executionVideoIds = new Set<string>();
    const collectionVideoIds = new Set<string>();

    for (const row of rows) {
        const contentMetadata = (row as { content_metadata?: MessageItem["contentMetadata"] }).content_metadata;
        const refs = contentMetadata?.video_references;
        if (!Array.isArray(refs) || refs.length === 0) continue;

        messageToRefs.set(row.id, refs);
        for (const ref of refs) {
            if (!ref?.videoId) continue;
            if (ref.videoId.startsWith("vc:")) {
                collectionVideoIds.add(ref.videoId.slice(3));
            } else {
                executionVideoIds.add(ref.videoId);
            }
        }
    }

    if (messageToRefs.size === 0) return new Map();

    const refreshedByVideoId = new Map<string, VideoReferenceItem>();

    if (executionVideoIds.size > 0) {
        const { data: executionVideos } = await supabase
            .from("execution_set_videos")
            .select(`
                id,
                action_id,
                video_url,
                thumbnail_url,
                exercise_name,
                set_number,
                created_at,
                plan_instance_executions!inner(student_id, action_executions, day_index)
            `)
            .in("id", Array.from(executionVideoIds));

        for (const video of executionVideos || []) {
            let actionName = video.exercise_name || "未命名动作";
            let weight: number | null = null;
            let reps: number | null = null;

            const matchedAction = findMatchingActionExecution(
                (video as any).plan_instance_executions?.action_executions,
                video.action_id,
            );
            if (matchedAction) {
                actionName = matchedAction.action_name || matchedAction.name || actionName;

                const matchedSet = findMatchingSetExecution(
                    matchedAction.sets,
                    video.set_number || 1,
                );
                if (matchedSet) {
                    weight = pickSetValue(
                        matchedSet,
                        "actual_weight",
                        "actualWeight",
                        "completed_weight",
                        "planned_weight",
                        "plannedWeight",
                        "weight",
                    );
                    reps = pickSetValue(
                        matchedSet,
                        "actual_reps",
                        "actualReps",
                        "completed_reps",
                        "planned_reps",
                        "plannedReps",
                        "reps",
                    );
                }
            }

            refreshedByVideoId.set(video.id, {
                videoId: video.id,
                videoUrl: video.video_url,
                thumbnailUrl: video.thumbnail_url,
                actionName,
                sourceType: "execution_set",
                setNumber: video.set_number || 1,
                weight,
                reps,
                isProgress: false,
                createdAt: video.created_at,
                dayIndex: (video as any).plan_instance_executions?.day_index ?? null,
            });
        }
    }

    if (collectionVideoIds.size > 0) {
        const { data: collections } = await supabase
            .from("student_video_collections")
            .select(`
                id,
                video_url,
                thumbnail_url,
                created_at,
                title,
                description,
                tags,
                source
            `)
            .in("id", Array.from(collectionVideoIds))
            .is("deleted_at", null);

        for (const collection of collections || []) {
            const title = (collection.title || "").trim();
            const description = (collection.description || "").trim();
            refreshedByVideoId.set(`vc:${collection.id}`, {
                videoId: `vc:${collection.id}`,
                videoUrl: collection.video_url,
                thumbnailUrl: collection.thumbnail_url,
                actionName: title || description || "个人上传视频",
                description: description || null,
                tags: Array.isArray(collection.tags) ? collection.tags : [],
                sourceType: "video_collection",
                setNumber: 1,
                weight: null,
                reps: null,
                isProgress: collection.source === "progress_set",
                createdAt: collection.created_at,
                dayIndex: null,
            });
        }
    }

    const refreshedByMessageId = new Map<string, VideoReferenceItem[]>();
    for (const [messageId, refs] of messageToRefs.entries()) {
        refreshedByMessageId.set(
            messageId,
            refs.map((ref) => refreshedByVideoId.get(ref.videoId) || ref),
        );
    }

    return refreshedByMessageId;
}

export async function mapChatMessageRowsToItems(
    rows: ChatMessageRow[],
    userId: string,
): Promise<MessageItem[]> {
    if (!rows.length) return [];

    const senderIds = [...new Set(rows.map((message) => message.sender_id))];
    const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", senderIds);

    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]) || []);
    const refreshedVideoReferences = await refreshVideoReferences(rows);

    return rows.map((message) => {
        const profile = profileMap.get(message.sender_id);
        const rawContentMetadata = (message as { content_metadata?: MessageItem["contentMetadata"] })
            .content_metadata ?? null;
        const contentMetadata = rawContentMetadata
            ? {
                ...rawContentMetadata,
                video_references: refreshedVideoReferences.get(message.id) || rawContentMetadata.video_references,
            }
            : null;

        return {
            id: message.id,
            chatUserId: message.sender_id,
            chatUserProfile: {
                name: profile?.nickname || "",
                avatar: profile?.avatar_url || null,
            },
            messageType: message.message_type,
            content: message.content ?? "",
            mediaUrl: message.media_url,
            fileName: message.file_name,
            fileSize: message.file_size,
            duration: message.duration,
            isRead: message.is_read,
            createdAt: message.created_at,
            isMine: message.sender_id === userId,
            contentMetadata,
        };
    });
}
