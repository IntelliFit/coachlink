import { filterPublicCoachApplicationMaterials } from "@/lib/coachApplicationMaterials";

/**
 * Coach fields that only the coach themselves and admins may see.
 *
 * The coach list, coach detail and aggregated-info routes are public (see src/proxy.ts) and used
 * to return whole `coaches` rows, including payment account tokens, invitation codes and contact
 * details. Everything else in the row stays visible: name, title, bio, specialties, track,
 * location (coaches publish it on purpose for offline lessons) and `huifu_open_status`, which the
 * subscription button reads to know whether the coach can take payments.
 */
const PRIVATE_COACH_KEYS = new Set([
    "payment_qr_code",
    "payment_qr_codes",
    "allow_personal_qrcode",
    "payment_mode",
    "invitation_code",
    "invitation_mode",
    "search_vector",
]);

/** huifu_open_status stays public; account ids, tokens, messages and raw responses do not. */
const PUBLIC_HUIFU_KEYS = new Set(["huifu_open_status"]);

const PRIVATE_PROFILE_KEYS = ["contactEmail", "contactPhone", "socialLinks"] as const;

function isPrivateCoachKey(key: string): boolean {
    if (PRIVATE_COACH_KEYS.has(key)) return true;
    return key.startsWith("huifu_") && !PUBLIC_HUIFU_KEYS.has(key);
}

interface PublicViewOptions {
    /**
     * Keep contact email / phone / social links. The coach profile (web and mini-program "介绍")
     * shows them to everyone, guests included (product decision 2026-10-20). Lists do not display
     * them, so they drop them.
     */
    keepContact?: boolean;
}

/** View used by the coach profile and single-coach lookups: contact details are public. */
export const COACH_PROFILE_VIEW: PublicViewOptions = { keepContact: true };

/** Returns a copy of a coach row without private fields. Never mutates the input. */
export function toPublicCoachView<T extends Record<string, any> | null | undefined>(coach: T, options: PublicViewOptions = {}): T {
    if (!coach || typeof coach !== "object") return coach;

    const next: Record<string, any> = {};
    for (const [key, value] of Object.entries(coach)) {
        if (!isPrivateCoachKey(key)) next[key] = value;
    }

    if (next.profile && typeof next.profile === "object") {
        const profile: Record<string, any> = { ...next.profile };
        if (!options.keepContact) {
            for (const key of PRIVATE_PROFILE_KEYS) delete profile[key];
        }
        if (profile.applicationMaterials) {
            profile.applicationMaterials = filterPublicCoachApplicationMaterials(profile.applicationMaterials);
        }
        next.profile = profile;
    }

    return next as T;
}

export interface CoachViewer {
    userId: string | null;
    isAdmin: boolean;
}

/** The coach themselves and admins see the full row. */
export function canViewPrivateCoachFields(viewer: CoachViewer, coach: { user_id?: string | null } | null | undefined): boolean {
    if (viewer.isAdmin) return true;
    return Boolean(viewer.userId && coach?.user_id && viewer.userId === coach.user_id);
}

export function coachViewForViewer<T extends Record<string, any> | null | undefined>(
    viewer: CoachViewer,
    coach: T,
    options: PublicViewOptions = {},
): T {
    return canViewPrivateCoachFields(viewer, coach) ? coach : toPublicCoachView(coach, options);
}
