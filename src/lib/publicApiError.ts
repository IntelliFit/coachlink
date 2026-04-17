/**
 * 将服务端异常转换为用户可读文案，避免把 Node 内部错误（如 path/TypeError）直接暴露给小程序或前端。
 */
export function toPublicApiMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
    const msg =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : String(error);

    if (!msg || !msg.trim()) return fallback;

    if (
        msg.includes('ERR_INVALID_ARG_TYPE') ||
        msg.includes('path" argument must be of type string') ||
        msg.includes('Received undefined') ||
        (msg.includes('ENOENT') && msg.includes('no such file'))
    ) {
        return fallback;
    }

    return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg;
}
