export interface UpdateCoachProfileDto {
    id?: string;
    userId?: string;
    name?: string;
    title?: string | null;
    avatarUrl?: string | null;
    specialties?: string[] | null;
    yearsExperience?: number | null;
    bio?: string;
    profile?: {
        teachingPhilosophy?: string;
        achievements?: string[];
        caseStudies?: string[];
        credentials?: { name: string; url?: string }[];
        contactEmail?: string | null;
        contactPhone?: string | null;
        socialLinks?: Record<string, string>;
    };

    invitationCode?: string;
    invitationMode?: "exclusive" | "open";
    coachTrack?: string | null;
    serviceModes?: string[] | null;
    targetStudentLevels?: string[] | null;
    supportFocus?: string | null;

    /** 省 */
    province?: string | null;
    /** 市 */
    city?: string | null;
    /** 区/县 */
    county?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

export interface UpdateCoachProfileResponseDto {

}
