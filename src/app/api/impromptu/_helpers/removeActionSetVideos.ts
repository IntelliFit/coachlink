import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { cosRemove } from "@/lib/cos";
import { isManagedStoragePath } from "./setVideoUpload";

type VideoRow = {
    id: string;
    action_index: number;
    storage_path: string | null;
    file_size_bytes: number | null;
};
type Move = { id: string; index: number };

// 表上有 (execution_id, action_index, set_number) 唯一约束，直接改会撞车，先挪到临时区间。
const TEMP_BASE = 1_000_000;
const RESTORE_TEMP_BASE = 2_000_000;
// 被删动作的行先停在这里，动作列表落库后才真正删除，落库失败还能原样恢复。
const PARKED_INDEX = 3_000_000;

async function writeIndexes(moves: Move[], tempBase: number): Promise<boolean> {
    for (const offset of [tempBase, 0]) {
        for (const move of moves) {
            const { error } = await (supabase as any)
                .from("impromptu_execution_set_videos")
                .update({ action_index: offset + move.index })
                .eq("id", move.id);
            if (error) {
                console.error("[impromptu-set-video] remove action move failed:", error.message);
                return false;
            }
        }
    }
    return true;
}

async function purgeRows(rows: VideoRow[], userId: string): Promise<boolean> {
    if (rows.length === 0) return true;

    const { error } = await (supabase as any)
        .from("impromptu_execution_set_videos")
        .delete()
        .in("id", rows.map((row) => row.id));
    if (error) {
        console.error("[impromptu-set-video] remove action delete failed:", error.message);
        return false;
    }

    const managedPaths = rows
        .map((row) => row.storage_path)
        .filter((path): path is string => isManagedStoragePath(path));
    await cosRemove("videos", managedPaths).catch((removeError) =>
        console.error("[impromptu-set-video] delete removed action video failed:", removeError)
    );

    const freedBytes = rows.reduce((sum, row) => sum + Math.max(0, Number(row.file_size_bytes || 0)), 0);
    if (freedBytes > 0) {
        try {
            const { incrementStorageUsage } = await import("@/lib/membershipLimit");
            await incrementStorageUsage(userId, -freedBytes);
        } catch (usageError) {
            console.error("[impromptu-set-video] update storage usage failed:", usageError);
        }
    }
    return true;
}

/**
 * 即兴训练的组视频按 action_index 关联动作，删动作时要一起改：
 * 被删动作的行停放到 PARKED_INDEX，后面动作的行前移一位。
 * 返回 restore：动作列表落库失败时用它撤销；purge：落库成功后清掉停放的行及其文件。
 * null 表示视频没改成，且已尽力恢复，此时不能继续删动作。
 */
export async function detachRemovedActionSetVideos(
    executionId: string,
    actionIndex: number,
    userId: string,
): Promise<{ restore: () => Promise<boolean>; purge: () => Promise<boolean> } | null> {
    const { data, error } = await (supabase as any)
        .from("impromptu_execution_set_videos")
        .select("id, action_index, storage_path, file_size_bytes")
        .eq("execution_id", executionId);
    if (error) {
        console.error("[impromptu-set-video] remove action read failed:", error.message);
        return null;
    }
    const rows = (data || []) as VideoRow[];

    // 上次落库后清理失败的残留：对应动作早已不在，先清掉，否则组号相同的新行停不进去。
    if (!await purgeRows(rows.filter((row) => row.action_index === PARKED_INDEX), userId)) {
        return null;
    }

    const removed = rows.filter((row) => row.action_index === actionIndex);
    const following = rows.filter((row) => row.action_index > actionIndex && row.action_index < TEMP_BASE);
    const moves = [
        ...removed.map((row) => ({ id: row.id, index: PARKED_INDEX })),
        ...following.map((row) => ({ id: row.id, index: row.action_index - 1 })),
    ];
    const originals = [...removed, ...following].map((row) => ({ id: row.id, index: row.action_index }));
    const restore = () => writeIndexes(originals, RESTORE_TEMP_BASE);

    if (!await writeIndexes(moves, TEMP_BASE)) {
        await restore();
        return null;
    }
    return { restore, purge: () => purgeRows(removed, userId) };
}
