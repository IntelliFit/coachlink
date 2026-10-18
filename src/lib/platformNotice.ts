import { sendSystemMessage } from "./chat";
import { serviceRoleSupabase } from "./supabaseClient";

/**
 * 平台待办通知：把需要管理员处理的事件（教练申请、用户反馈、提现等）
 * 由「教链小助手」系统账号私信给平台运营者，免得必须登录管理员后台才能看到。
 *
 * 接收人默认是创始人（枭马葛）的两个账号，可用环境变量
 * PLATFORM_NOTICE_RECIPIENT_USER_IDS（逗号分隔的 users.id）覆盖。
 */
const DEFAULT_RECIPIENT_USER_IDS = [
    "f9eac5b1-45f9-4479-9ab8-8223a5db8835", // 枭马葛（教练账号）
    "aa0edb1d-b757-49ba-b29f-22c05965e5dd", // 创始人第二个账号
];

const DEFAULT_BASE_URL = "https://coachlink.fit";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FIELD_LENGTH = 80;
// markdown-it 不开 breaks，行尾两个空格才会换行；小程序纯文本显示时看不出来。
const LINE_BREAK = "  \n";

export type PlatformNoticeKind =
    | "coach_application_new"
    | "coach_application_resubmitted"
    | "feedback_new"
    | "withdrawal_pending";

export type PlatformNotice = {
    kind: PlatformNoticeKind;
    title: string;
    fields: ReadonlyArray<readonly [label: string, value: string | number | null | undefined]>;
    adminPath: string;
};

export function resolvePlatformNoticeRecipients(
    raw: string | undefined = process.env.PLATFORM_NOTICE_RECIPIENT_USER_IDS,
): string[] {
    const configured = (raw || "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_PATTERN.test(id));
    const ids = configured.length > 0 ? configured : DEFAULT_RECIPIENT_USER_IDS;
    return Array.from(new Set(ids));
}

/** 用户输入只保留单行并截断，避免撑爆消息或伪造多行内容。 */
export function toNoticeField(value: string | number | null | undefined): string {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}…` : text;
}

export function buildPlatformNoticeContent(
    notice: PlatformNotice,
    baseUrl: string = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL,
): string {
    const fieldLines = notice.fields
        .map(([label, value]) => [label, toNoticeField(value)] as const)
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}：${value}`);
    const link = `${baseUrl.replace(/\/+$/, "")}${notice.adminPath}`;
    return [`【平台待办】${notice.title}`, ...fieldLines, `处理入口：${link}`].join(LINE_BREAK);
}

/** 查用户昵称，用于通知里展示「谁」触发了事件；失败时返回空串。 */
export async function getNoticeUserName(userId: string): Promise<string> {
    try {
        const { data } = await serviceRoleSupabase
            .from("user_profiles")
            .select("nickname")
            .eq("user_id", userId)
            .maybeSingle();
        return data?.nickname || "";
    } catch (error) {
        console.error("[platform-notice] load nickname failed:", error);
        return "";
    }
}

/**
 * 发送平台待办通知。永不抛错：通知失败不能影响用户的提交主流程。
 * 返回成功送达的接收人数量。
 */
export async function notifyPlatformOwners(notice: PlatformNotice): Promise<number> {
    try {
        const content = buildPlatformNoticeContent(notice);
        const results = await Promise.all(
            resolvePlatformNoticeRecipients().map((recipientId) =>
                sendSystemMessage(recipientId, {
                    content,
                    content_metadata: {
                        platform_notice: { kind: notice.kind, admin_path: notice.adminPath },
                    },
                }).catch((error) => {
                    console.error("[platform-notice] send failed:", notice.kind, error);
                    return false;
                }),
            ),
        );
        const delivered = results.filter(Boolean).length;
        if (delivered < results.length) {
            console.error(
                `[platform-notice] ${notice.kind} delivered to ${delivered}/${results.length} recipients`,
            );
        }
        return delivered;
    } catch (error) {
        console.error("[platform-notice] notify failed:", notice.kind, error);
        return 0;
    }
}
