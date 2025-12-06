import type { SessionContextValue } from "next-auth/react";

export function getUserDisplayName(session: SessionContextValue["data"]) {
    if (session?.profile?.nickname) {
        return session.profile.nickname;
    }
    if (session?.profile?.full_name) {
        return session.profile.full_name;
    }
    if (session?.user?.phone) {
        return session.user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
    }
    return "用户";
}

export function getCoachTitle(session: SessionContextValue["data"]) {
    const level = session?.user.subscription_level || "basic";
    const titles = {
        basic: "健身爱好者",
        advanced: "健身指导师",
        premium: "专业健身教练",
    };
    return titles[level as keyof typeof titles];
}

export function getCoachRating(session: SessionContextValue["data"]) {
    // 基础评分根据用户等级
    const level = session?.user.subscription_level || "basic";
    const baseRating = {
        basic: 4.0,
        advanced: 4.5,
        premium: 4.8,
    };

    // 可以根据更多因素调整评分，比如用户活跃度、训练记录等
    // 这里先返回基础评分
    return baseRating[level as keyof typeof baseRating];
}

export function getCoach(session: SessionContextValue["data"] | null) {
    if (session) {
        return {
            id: session?.user.id,
            name: getUserDisplayName(session),
            title: getCoachTitle(session),
            rating: getCoachRating(session),
        };
    }

    return {
        id: "",
        name: "",
        title: "",
        rating: 0,
    };
}
