type VideoRow = { id: string; action_index: number };
type Move = { id: string; index: number };

// 表上有 (execution_id, action_index, set_number) 唯一约束，直接改会撞车，先挪到临时区间。
const TEMP_BASE = 1_000_000;
const RESTORE_TEMP_BASE = 2_000_000;

async function writeIndexes(client: any, moves: Move[], tempBase: number): Promise<boolean> {
    for (const offset of [tempBase, 0]) {
        for (const move of moves) {
            const { error } = await client
                .from("impromptu_execution_set_videos")
                .update({ action_index: offset + move.index })
                .eq("id", move.id);
            if (error) {
                console.error("[impromptu-set-video] reorder failed:", error.message);
                return false;
            }
        }
    }
    return true;
}

/**
 * 即兴训练的组视频按 action_index 关联动作，换序时要一起改。
 * 返回 restore：动作列表落库失败时用它撤销；null 表示视频没改成，且已尽力恢复。
 */
export async function remapImpromptuSetVideos(
    client: any,
    executionId: string,
    order: number[],
): Promise<{ restore: () => Promise<boolean> } | null> {
    const { data, error } = await client
        .from("impromptu_execution_set_videos")
        .select("id, action_index")
        .eq("execution_id", executionId);
    if (error) {
        console.error("[impromptu-set-video] reorder read failed:", error.message);
        return null;
    }

    const changed = ((data || []) as VideoRow[])
        .map((row) => ({ row, index: order.indexOf(row.action_index) }))
        .filter(({ row, index }) => index >= 0 && index !== row.action_index);
    const moves = changed.map(({ row, index }) => ({ id: row.id, index }));
    const originals = changed.map(({ row }) => ({ id: row.id, index: row.action_index }));
    const restore = () => writeIndexes(client, originals, RESTORE_TEMP_BASE);

    if (!await writeIndexes(client, moves, TEMP_BASE)) {
        await restore();
        return null;
    }
    return { restore };
}
