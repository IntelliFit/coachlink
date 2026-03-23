const OFFLINE_PAYMENT_COACH_NAMES = new Set(["枭马葛", "刘三乐"]);

export function supportsOfflinePaymentForCoach(params: {
    coachName?: string | null;
}) {
    const coachName = String(params.coachName ?? "").trim();
    if (!coachName) return false;
    return OFFLINE_PAYMENT_COACH_NAMES.has(coachName);
}

