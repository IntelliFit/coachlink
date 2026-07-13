import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";
import type { ExtractFileTextResponseDto } from "./entity";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { getCoachlinkVisionLlm } from "@/lib/coachlinkLlm";

// pdf-parse 顶层 index.js 包含“直接运行时读取 test/data”的调试副作用，
// Turbopack 收集路由数据时会误触发；直接使用无副作用的解析实现。
const pdf = require("pdf-parse/lib/pdf-parse.js") as (
    data: Buffer,
) => Promise<{ text?: string }>;

/** 支持的文件扩展名 */
const ALLOWED_EXTENSIONS = ["txt", "csv", "md", "docx", "xlsx", "xls", "pdf", "png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function sourceTypeFor(ext: string): ExtractFileTextResponseDto["sourceType"] {
    if (["xlsx", "xls"].includes(ext)) return "spreadsheet";
    if (ext === "docx") return "document";
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
    return "text";
}

async function extractPlanFromImage(params: { buffer: Buffer; mimeType: string; fileName: string }) {
    const { client, model } = getCoachlinkVisionLlm();
    const imageUrl = `data:${params.mimeType};base64,${params.buffer.toString("base64")}`;
    const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 8000,
        messages: [{
            role: "user",
            content: [
                {
                    type: "text",
                    text: "这是一份训练计划图片。请逐行忠实转写为可供训练计划导入器解析的纯文本：保留周/日、动作、组数、次数、重量、RM、RPE、休息、备注和休息日；看不清的内容标记为【无法辨认】。禁止补写或猜测。只输出转写文本。",
                },
                { type: "image_url", image_url: { url: imageUrl } },
            ],
        }],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("视觉模型未返回可导入文本");
    return text;
}

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
                message: `仅支持 .txt、.csv、.md、.docx、.xlsx、.xls、.pdf、.png、.jpg、.jpeg、.webp 格式，当前为 .${ext || "未知"}`,
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
        let extractionMethod: ExtractFileTextResponseDto["extractionMethod"] = "deterministic";
        const warnings: string[] = [];

        if (["txt", "csv", "md"].includes(ext)) {
            text = buffer.toString("utf8");
        } else if (ext === "docx") {
            // Word 文档：使用 mammoth 提取纯文本
            const result = await mammoth.extractRawText({ buffer });
            text = result.value || "";
        } else if (["xlsx", "xls"].includes(ext)) {
            // Excel: 使用 xlsx 解析并转为可读文本
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const lines: string[] = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) continue;
                const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
                if (rows.length > 0) {
                    lines.push(`[工作表: ${sheetName}]`);
                    const header = rows[0].map((value) => String(value).trim());
                    rows.slice(1).forEach((row, index) => {
                        const cells = row
                            .map((value, cellIndex) => `${header[cellIndex] || `列${cellIndex + 1}`}=${String(value).trim()}`)
                            .filter((entry) => !entry.endsWith("="));
                        if (cells.length > 0) lines.push(`[${sheetName} 第${index + 2}行] ${cells.join("；")}`);
                    });
                    lines.push("");
                }
            }
            text = lines.join("\n").trim();
        } else if (ext === "pdf") {
            const parsed = await pdf(buffer);
            text = parsed.text?.trim() || "";
            if (text.length < 20) {
                return NextResponse.json({
                    success: false,
                    message: "该 PDF 没有可提取的文字，可能是扫描件。请将页面导出为图片后上传，系统会使用视觉识别。",
                    data: null,
                }, { status: 422 });
            }
        } else {
            extractionMethod = "vision";
            text = await extractPlanFromImage({
                buffer,
                mimeType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
                fileName: file.name,
            });
            warnings.push("图片内容由视觉模型转写，请在导入前核对【无法辨认】标记和关键训练数字。");
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
            data: {
                text: text.trim(),
                sourceType: sourceTypeFor(ext),
                extractionMethod,
                warnings,
            },
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
