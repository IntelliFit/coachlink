/**
 * Derives a short preview line for chat room list from `chat_rooms.last_message`.
 * Training feedback and other multi-line system texts put the user-visible body on a `内容：` line.
 */
const PREVIEW_MAX = 120;

export function getConversationPreview(lastMessage: string | null | undefined): string {
    if (lastMessage == null || lastMessage === "") {
        return "暂无消息";
    }

    const trimmed = lastMessage.trim();
    if (!trimmed) {
        return "暂无消息";
    }

    // Literal placeholders from send-message route
    if (trimmed === "[图片]") return "[图片]";
    if (trimmed === "[文件]") return "[文件]";

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const contentLine = lines.find((l) => l.startsWith("内容：") || l.startsWith("内容:"));
    if (contentLine) {
        const body = contentLine.replace(/^内容[：:]\s*/, "").trim();
        if (body) {
            return truncateOneLine(`反馈：${body}`, PREVIEW_MAX);
        }
    }

    const trainingLine = lines.find((l) => l.includes("【训练反馈】"));
    if (trainingLine) {
        const dayMatch = trainingLine.match(/第\s*(\d+)\s*天/);
        const dayPart = dayMatch ? `第${dayMatch[1]}天` : "";
        const difficultyLine = lines.find((l) => l.startsWith("难度：") || l.startsWith("难度:"));
        const diff = difficultyLine
            ? difficultyLine.replace(/^难度[：:]\s*/, "").trim()
            : "";
        const parts = ["训练反馈", dayPart, diff].filter(Boolean);
        return truncateOneLine(parts.join(" · "), PREVIEW_MAX);
    }

    // Prefer first substantial line if multi-line
    const first = lines[0] ?? trimmed;
    return truncateOneLine(first.replace(/\s+/g, " "), PREVIEW_MAX);
}

function truncateOneLine(s: string, max: number): string {
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
}
