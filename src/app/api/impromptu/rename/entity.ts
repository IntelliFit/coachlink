export interface RenameImpromptuDto {
    executionId: string;
    /** 空字符串或 null 表示恢复默认名称 */
    title: string | null;
}

export interface RenameImpromptuResponseDto {
    id: string;
    title: string | null;
}
