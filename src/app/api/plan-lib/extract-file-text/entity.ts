// 提取文件文本请求：通过 FormData 上传，字段名为 file
// 无需 DTO，服务端从 formData 读取

// 返回参数
export interface ExtractFileTextResponseDto {
    text: string;
    sourceType: "text" | "spreadsheet" | "document" | "pdf" | "image";
    extractionMethod: "deterministic" | "vision";
    warnings?: string[];
}
