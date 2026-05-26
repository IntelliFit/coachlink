'use client';

import type { Session } from 'next-auth';

type UserProfileLike = {
    nickname?: string | null;
    gender?: string | null;
    height?: number | null;
    weight?: number | null;
    fitness_goal?: string | null;
    fitness_level?: string | null;
    onboarding_completed?: boolean | null;
};

function isCoreProfileCompleted(profile?: UserProfileLike | null): boolean {
    if (!profile) return false;

    const hasNickname = !!profile.nickname?.trim();
    const hasGender = !!profile.gender;
    const hasHeight = typeof profile.height === 'number' && profile.height > 0;
    const hasWeight = typeof profile.weight === 'number' && profile.weight > 0;
    const hasGoal = !!profile.fitness_goal;
    const hasLevel = !!profile.fitness_level;

    return hasNickname && hasGender && hasHeight && hasWeight && hasGoal && hasLevel;
}

export async function resolvePostLoginDestination(options?: {
    session?: Session | null;
    fallbackPath?: string;
}): Promise<string> {
    const fallbackPath = options?.fallbackPath || '/today-training';
    const session = options?.session;
    const user = session?.user as
        | {
              is_admin?: boolean;
              is_coach?: boolean;
              primary_role?: string;
          }
        | undefined;

    if (!session?.user?.id) {
        return fallbackPath;
    }

    if (user?.is_admin || user?.primary_role === 'coach') {
        return fallbackPath;
    }

    try {
        const profileRes = await fetch('/api/user/get-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        if (!profileRes.ok) {
            return '/complete-profile';
        }

        const profileJson = await profileRes.json();
        const profile = profileJson?.data?.profile as UserProfileLike | undefined;
        const done = profile?.onboarding_completed === true && isCoreProfileCompleted(profile);

        return done ? fallbackPath : '/complete-profile';
    } catch {
        return '/complete-profile';
    }
}

