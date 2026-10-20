import { getAuthUser } from "@/lib/auth";
import type { CoachViewer } from "@/lib/coachPublicView";

/** Who is asking for coach data: web session or mini-program Bearer token, or a guest. */
export async function getCoachViewer(req: Request): Promise<CoachViewer> {
    try {
        const auth = await getAuthUser(req);
        return { userId: auth.userId, isAdmin: Boolean(auth.user?.is_admin) };
    } catch (error) {
        console.error("[coach-viewer] resolve viewer:", error);
        return { userId: null, isAdmin: false };
    }
}
