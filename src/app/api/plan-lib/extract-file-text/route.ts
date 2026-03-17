import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";
import type { ExtractFileTextResponseDto } from "./entity";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

/** 支持的文件扩展名 */
const ALLOWED_EXTENSIONS = ["docx", "xlsx", "xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 从 Word/Excel 文件中提取文本
 * POST multipart/form-data, 字段名: file
 * 教练和学员均可使用（仅需登录）
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file || !(file instanceof File)) {
            return NextResponse.json({
                success: false,
                message: "请上传文件",
                data: null,
            }, { status: 400 });
        }

        const ext = (file.name.toLowerCase().split(".").pop() || "").trim();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json({
                success: false,
                message: `仅支持 .docx、.xlsx、.xls 格式，当前为 .${ext || "未知"}`,
                data: null,
            }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                success: false,
                message: `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                data: null,
            }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let text: string;

        if (ext === "docx") {
            // Word 文档：使用 mammoth 提取纯文本
            const result = await mammoth.extractRawText({ buffer });
            text = result.value || "";
        } else {
            // Excel: 使用 xlsx 解析并转为可读文本
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const lines: string[] = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) continue;
                // 转为 CSV 格式（逗号分隔），便于 AI 解析表格结构
                const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", RS: "\n" });
                if (csv.trim()) {
                    lines.push(`[工作表: ${sheetName}]`);
                    lines.push(csv);
                    lines.push("");
                }
            }
            text = lines.join("\n").trim();
        }

        if (!text || !text.trim()) {
            return NextResponse.json({
                success: false,
                message: "无法从文件中提取到有效文本，请检查文件内容",
                data: null,
            }, { status: 400 });
        }

        return NextResponse.json<ApiData<ExtractFileTextResponseDto>>({
            success: true,
            message: "提取成功",
            data: { text: text.trim() },
        });
    } catch (error) {
        console.error("Extract file text error:", error);
        return NextResponse.json({
            success: false,
            message: "解析文件失败，请检查文件格式是否正确",
            data: null,
        }, { status: 500 });
    }
}
