import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { hashPassword } from "../[...nextauth]/verify";
import { RegisterDto, RegisterResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import redis from "@/lib/redisClient";
import { MEMBER_BENEFITS } from "@/app/service/studentMembershipService";

function startOfDayISO(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function safeDecodeAttribution(raw: string | undefined) {
    if (!raw) return null;
    try {
        return JSON.parse(decodeURIComponent(raw));
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    const {
        phoneOrEmail,
        password,
        verifyCode,
        ref,
        shareId,
        invitationCode,
    } = await req.json() as RegisterDto;

    const trimmedPhoneOrEmail = phoneOrEmail?.trim();
    const trimmedPassword = password?.trim();
    const trimmedVerifyCode = verifyCode?.trim();

    if (!trimmedPhoneOrEmail || !trimmedPassword) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "手机号或邮箱和密码不能为空",
            data: null,
        });
    }

    if (!trimmedVerifyCode) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "验证码不能为空",
            data: null,
        });
    }

    // Determine if input is phone or email
    const isPhone = /^1[3-9]\d{9}$/.test(trimmedPhoneOrEmail);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedPhoneOrEmail);

    if (!isPhone && !isEmail) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "请输入正确的手机号或邮箱格式",
            data: null,
        });
    }

    // 生产模式：验证真实验证码
    if (!redis) {
        throw new Error("验证服务不可用");
    }

    // 根据是手机号还是邮箱来查询验证码
    const verificationKey = isPhone
        ? `sms_verification_code:${trimmedPhoneOrEmail}`
        : `email_verification_code:${trimmedPhoneOrEmail}`;

    const storedCode = await redis.get(verificationKey);
    if (!storedCode) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "验证码已过期或不存在",
            data: null,
        });
    }

    if (storedCode !== trimmedVerifyCode) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "验证码错误",
            data: null,
        });
    }

    // 验证成功后删除验证码，防止重复使用
    await redis.del(verificationKey);

    // Check if user already exists by phone or email
    let existingUserQuery;
    if (isPhone) {
        existingUserQuery = supabase
            .from("users")
            .select("id")
            .eq("phone", trimmedPhoneOrEmail)
            .single();
    } else {
        existingUserQuery = supabase
            .from("users")
            .select("id")
            .eq("email", trimmedPhoneOrEmail)
            .single();
    }

    const { data: existingUser } = await existingUserQuery;

    if (existingUser) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: isPhone ? "手机号已注册" : "邮箱已注册",
            data: null,
        });
    }

    const password_hash = hashPassword(trimmedPassword);

    // 处理教练邀请码：查找对应的教练
    let referrerCoachId: string | null = null;
    if (invitationCode?.trim()) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("id")
            .eq("invitation_code", invitationCode?.trim())
            .eq("status", "approved")
            .single();

        if (!coach?.id) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "邀请码无效或教练未通过审核",
                data: null,
            });
        }

        referrerCoachId = coach.id;
    }

    const { data: user } = await supabase
        .from("users")
        .insert({
            ...(isPhone ? { phone: trimmedPhoneOrEmail } : { email: trimmedPhoneOrEmail }),
            password_hash,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
            ...(referrerCoachId && { invitation_coach_id: referrerCoachId }),
        })
        .select("*")
        .single();

    // --- Acquisition Rewards (MVP) ---
    // Two sources:
    // 1) direct_invite: /register?ref=<inviterUserId>
    // 2) share_card: QR -> /s/<shareId> -> /register?share=<shareId>
    //
    // Rules (per decision):
    // - 24h attribution window (share_card only, via expires_at/cookie)
    // - reward on successful registration
    // - both sides get +2 AI imports and +100MB storage
    // - daily cap: inviter gets max 10 share_card rewards/day
    // - no risk control for v1
    //
    // Reward should never block registration.
    try {
        const inviteeId = user.id as string | undefined;
        if (!inviteeId) {
            // Shouldn't happen, but avoid throwing
            throw new Error("No inviteeId after registration");
        }

        const now = new Date();
        // Reward values (current policy): both sides get +2 AI imports and +100MB storage.
        const rewardAi = 2;
        const rewardStorageMb = 100;

        const ensureAndGrantQuota = async (targetUserId: string) => {
            // Ensure quota row exists (init as free tier if missing)
            const { data: q } = await serviceRoleSupabase
                .from("student_quotas")
                .select("*")
                .eq("user_id", targetUserId)
                .maybeSingle();

            let quota = q as any;
            if (!quota) {
                const benefits = MEMBER_BENEFITS.free;
                const nowIso = now.toISOString();
                const { data: inserted } = await serviceRoleSupabase
                    .from("student_quotas")
                    .insert({
                        user_id: targetUserId,
                        ai_import_balance: benefits.ai_limit_monthly,
                        storage_total_mb: benefits.storage_mb,
                        storage_used_mb: 0,
                        last_reset_date: nowIso,
                        created_at: nowIso,
                        updated_at: nowIso,
                    } as any)
                    .select("*")
                    .single();
                quota = inserted as any;
            }

            const newAi = (quota?.ai_import_balance || 0) + rewardAi;
            const newStorage = (quota?.storage_total_mb || 0) + rewardStorageMb;

            await serviceRoleSupabase
                .from("student_quotas")
                .update({
                    ai_import_balance: newAi,
                    storage_total_mb: newStorage,
                    updated_at: now.toISOString(),
                } as any)
                .eq("user_id", targetUserId);
        };

        // Prevent duplicate rewards for same invitee (any source)
        const { data: existingReward } = await serviceRoleSupabase
            .from("referral_rewards")
            .select("id")
            .eq("invitee_id", inviteeId)
            .maybeSingle();

        if (existingReward) {
            // already rewarded (skip silently)
            throw new Error("Invitee already rewarded, skip");
        }

        // Determine source: share_card has higher priority than direct_invite
        let sourceType: "share_card" | "direct_invite" | null = null;
        let inviterId: string | null = null;
        let sourceId: string | null = null;

        // share_card
        const cookieAttr = safeDecodeAttribution(
            req.cookies.get("share_attribution")?.value,
        );
        const shareIdFromCookie = cookieAttr?.shareId as string | undefined;
        const effectiveShareId = (shareId || shareIdFromCookie || "").trim();

        if (effectiveShareId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: shareRow } = await (serviceRoleSupabase as any)
                .from("growth_share_links")
                .select("id, creator_user_id, expires_at")
                .eq("id", effectiveShareId)
                .maybeSingle();

            const expiresAt = shareRow?.expires_at
                ? new Date(shareRow.expires_at)
                : null;
            if (
                shareRow?.id &&
                (!expiresAt || expiresAt.getTime() >= now.getTime())
            ) {
                sourceType = "share_card";
                inviterId = shareRow.creator_user_id;
                sourceId = shareRow.id;
            }
        }

        // direct_invite fallback
        if (!sourceType) {
            const directInviter = (ref || "").trim();
            if (directInviter) {
                sourceType = "direct_invite";
                inviterId = directInviter;
                sourceId = null;
            }
        }

        if (!sourceType || !inviterId || inviterId === inviteeId) {
            // no valid source, skip
            throw new Error("No valid inviter source, skip");
        }

        // Validate inviter exists
        const { data: inviter } = await serviceRoleSupabase
            .from("users")
            .select("id")
            .eq("id", inviterId)
            .maybeSingle();
        if (!inviter?.id) {
            throw new Error("Inviter not found, skip");
        }

        // Daily cap for share_card only: max 10/day
        if (sourceType === "share_card") {
            const dayStart = startOfDayISO(now);
            const { data: todayRewards } = await serviceRoleSupabase
                .from("referral_rewards")
                .select("reward_granted, created_at")
                .eq("inviter_id", inviterId)
                .gte("created_at", dayStart);

            const shareCount = (todayRewards || []).filter((r: any) =>
                r?.reward_granted?.source_type === "share_card"
            ).length;

            if (shareCount >= 10) {
                throw new Error("Daily cap reached for share_card, skip");
            }
        }

        // Grant quotas to both sides
        await Promise.all([
            ensureAndGrantQuota(inviterId),
            ensureAndGrantQuota(inviteeId),
        ]);

        // Record reward
        await serviceRoleSupabase
            .from("referral_rewards")
            .insert({
                inviter_id: inviterId,
                invitee_id: inviteeId,
                status: "completed",
                reward_granted: {
                    source_type: sourceType,
                    source_id: sourceId,
                    ai_import: rewardAi,
                    storage_mb: rewardStorageMb,
                    granted_at: now.toISOString(),
                },
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
            } as any);

        // Record register_success event for share_card (best-effort)
        if (sourceType === "share_card" && sourceId) {
            (serviceRoleSupabase as any)
                .from("growth_share_events")
                .insert({
                    share_id: sourceId,
                    event_type: "register_success",
                    meta: { invitee_id: inviteeId },
                })
                .then(({ error }: any) => {
                    if (error) {
                        console.warn(
                            "Failed to insert register_success event:",
                            error,
                        );
                    }
                });
        }
    } catch (e) {
        console.warn("[referral] grant failed:", e);
    }
    // --- Acquisition Rewards END ---

    return NextResponse.json<ApiData<RegisterResponseDto>>({
        message: "注册成功",
        success: true,
        data: {
            user,
        },
    });
}
