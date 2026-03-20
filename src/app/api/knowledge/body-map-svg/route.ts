import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SVG_FILE_BY_VIEW = {
    front: "body-front.svg",
    back: "body-back.svg",
} as const;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const viewParam = searchParams.get("view");
    const view = viewParam === "back" ? "back" : "front";
    const fileName = SVG_FILE_BY_VIEW[view];
    const filePath = path.join(process.cwd(), "docs", "assets", fileName);

    try {
        const svg = await fs.readFile(filePath, "utf-8");
        return new NextResponse(svg, {
            status: 200,
            headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "public, max-age=300",
            },
        });
    } catch (error) {
        console.error("[body-map-svg] read failed:", error);
        return NextResponse.json(
            { success: false, message: "人体地图素材读取失败" },
            { status: 500 },
        );
    }
}
