import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { cosRemove } from "@/lib/cos";
import { isManagedStoragePath } from "./setVideoUpload";

type VideoRow = {
    id: string;
    action_index: number;
    set_number: number;
    storage_path: string | null;
    file_size_bytes: number | null;
};
type Move = { id: string; setNumber: number };

// 表上有 (execution_id, action_index, set_number) 唯一约束，直接改会撞车，先挪到临时区间。
// set_number 有 >= 1 的 CHECK 约束，所以临时值都是大正数。
const TEMP_BASE = 1_000_000;
const RESTORE_TEMP_BASE = 2_000_000;
// 被删组的行先停在这里，动作列表落库后才真正删除，落库失败还能原样恢复。
const PARKED_SET_NUMBER = 3_000_000;

async function writeSetNumbers(moves: Move[], tempBase: number): Promise<boolean> {
    for (const offset of [tempBase, 0]) {
        for (const move of moves) {
            const { error } = await (supabase as any)
                .from("impromptu_execution_set_videos")
                .update({ set_number: offset + move.setNumber })
                .eq("id", move.id);
            if (error) {
                console.error("[impromptu-set-video] remove set move failed:", error.message);
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
        console.error("[impromptu-set-video] remove set delete failed:", error.message);
        return false;
    }

    const managedPaths = rows
        .map((row) => row.storage_path)
        .filter((path): path is string => isManagedStoragePath(path));
    if (managedPaths.length > 0) {
        await cosRemove("videos", managedPaths).catch((removeError) =>
            console.error("[impromptu-set-video] delete removed set video failed:", removeError)
        );
    }

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
 * 即兴训练的组视频按 action_index + set_number 关联组，删组时要一起改：
 * 被删组的行停放到 PARKED_SET_NUMBER，同一动作后面组的行前移一位。
 * 返回 restore：动作列表落库失败时用它撤销；purge：落库成功后清掉停放的行及其文件。
 * null 表示视频没改成，且已尽力恢复，此时不能继续删组。
 */
export async function detachRemovedSetVideo(
    executionId: string,
    actionIndex: number,
    setNumber: number,
    userId: string,
): Promise<{ restore: () => Promise<boolean>; purge: () => Promise<boolean> } | null> {
    const { data, error } = await (supabase as any)
        .from("impromptu_execution_set_videos")
        .select("id, action_index, set_number, storage_path, file_size_bytes")
        .eq("execution_id", executionId);
    if (error) {
        console.error("[impromptu-set-video] remove set read failed:", error.message);
        return null;
    }
    const rows = (data || []) as VideoRow[];

    // 上次落库后清理失败的残留：对应的组早已不在，先清掉，否则同一动作的新行停不进去。
    if (!await purgeRows(rows.filter((row) => row.set_number === PARKED_SET_NUMBER), userId)) {
        return null;
    }

    const sameAction = rows.filter((row) => row.action_index === actionIndex);
    const removed = sameAction.filter((row) => row.set_number === setNumber);
    const following = sameAction.filter((row) => row.set_number > setNumber && row.set_number < TEMP_BASE);
    const moves = [
        ...removed.map((row) => ({ id: row.id, setNumber: PARKED_SET_NUMBER })),
        ...following.map((row) => ({ id: row.id, setNumber: row.set_number - 1 })),
    ];
    const originals = [...removed, ...following].map((row) => ({ id: row.id, setNumber: row.set_number }));
    const restore = () => writeSetNumbers(originals, RESTORE_TEMP_BASE);

    if (!await writeSetNumbers(moves, TEMP_BASE)) {
        await restore();
        return null;
    }
    return { restore, purge: () => purgeRows(removed, userId) };
}
