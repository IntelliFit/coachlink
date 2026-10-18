import type { SupabaseClient } from "@supabase/supabase-js";
import batchApprovals from "./streetWorkoutImageApprovals.json";

/** Final assets are generated CoachLink anatomy illustrations. Videos/photos are pose references only. */
type StreetWorkoutImageApproval = {
    canonicalActionId: string;
    imageUrl: string;
    sourceUrl: string;
    credit: string;
    license: string;
    reviewedAt: string;
    assetKind: "generated-illustration";
    styleReference: string;
    poseCount: number;
};

export const approvedStreetWorkoutImages: Record<string, StreetWorkoutImageApproval> = {
    ...(batchApprovals as Record<string, StreetWorkoutImageApproval>),
    "8b83f52f-1d03-406b-8e64-e921f813be18": {
        canonicalActionId: "auto_e051e34349e66344350282be",
        imageUrl: "https://cdn-assets.coachlink.fit/action-reference-images/street-workout-reviewed/auto_e051e34349e66344350282be/plank-v4-single-5e63bb04.png",
        sourceUrl: "https://www.dvidshub.net/video/825280/forearm-plank",
        credit: "CoachLink generated anatomy illustration; DVIDS used only to review the forearm plank posture",
        license: "Project-generated illustration; reference footage is public domain",
        reviewedAt: "2026-10-07",
        assetKind: "generated-illustration",
        styleReference: "design/image-workspace/outputs/anatomy-model-persona-sheet-v4.png and existing street-workout illustrations",
        poseCount: 1,
    },
};

type PublicActionIdentity = {
    id?: string | null;
    name?: string | null;
    detail?: string | null;
    type?: string | null;
    attrs?: string[] | null;
    canonical_action_id?: string | null;
    reference_image_url?: string | null;
};

const commonStreetNames = new Set(["跪姿俯卧撑", "平板支撑", "击掌俯卧撑", "反手引体"]);

export function isStreetWorkoutAction(action: PublicActionIdentity): boolean {
    const type = String(action.type || "STRENGTH").toUpperCase();
    if (type !== "STRENGTH" && type !== "STREET_REVIEW_PENDING") return false;
    return (action.attrs || []).includes("街头健身") ||
        String(action.detail || "").includes("街头健身") ||
        String(action.canonical_action_id || "").startsWith("street_workout_") ||
        commonStreetNames.has(String(action.name || ""));
}

export function isStreetWorkoutAwaitingImageReview(action: PublicActionIdentity): boolean {
    if (action.type === "STREET_REVIEW_PENDING") return true;
    if (!isStreetWorkoutAction(action)) return false;
    const approved = action.id ? approvedStreetWorkoutImages[action.id] : null;
    return !approved || action.canonical_action_id !== approved.canonicalActionId ||
        action.reference_image_url !== approved.imageUrl;
}

/** Check the current canonical image, including callers whose public rows omit it. */
export async function filterReviewedStreetWorkoutActions<T extends PublicActionIdentity>(
    db: SupabaseClient,
    actions: T[],
): Promise<T[]> {
    const canonicalIds = [...new Set(actions.flatMap((action) => {
        const approved = action.id ? approvedStreetWorkoutImages[action.id] : null;
        return isStreetWorkoutAction(action) && action.type !== "STREET_REVIEW_PENDING" &&
            approved && action.canonical_action_id === approved.canonicalActionId
            ? [approved.canonicalActionId] : [];
    }))];
    const imageUrls = new Map<string, string | null>();
    if (canonicalIds.length) {
        const { data, error } = await db.from("canonical_actions")
            .select("id, reference_image_url").in("id", canonicalIds);
        if (error) throw error;
        for (const row of data || []) imageUrls.set(row.id, row.reference_image_url);
    }
    return actions.filter((action) => !isStreetWorkoutAwaitingImageReview({
        ...action,
        reference_image_url: action.canonical_action_id
            ? imageUrls.get(action.canonical_action_id) ?? null : null,
    }));
}
