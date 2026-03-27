export interface AppVersionInfo {
    appVersion: string;
    gitCommitId: string;
    buildTime: string;
}

export function getAppVersionInfo(): AppVersionInfo {
    return {
        // IMPORTANT:
        // - 这里必须显式读取 env key，否则 Next.js 无法在构建时内联（导致运行时变成 unknown）。
        appVersion: (process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || '0.0.0').trim(),
        gitCommitId: (process.env.NEXT_PUBLIC_GIT_COMMIT_ID || process.env.GIT_COMMIT_ID || 'unknown').trim(),
        buildTime: (process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || 'unknown').trim(),
    };
}
