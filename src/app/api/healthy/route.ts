import { NextResponse } from "next/server";

import { getAppVersionInfo } from "@/lib/version";
import { readOTelConfig } from "@/lib/observability/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    const version = getAppVersionInfo();
    const otel = readOTelConfig();

    return NextResponse.json({
        success: true,
        message: "ok",
        data: {
            status: "healthy",
            service: otel.serviceName,
            environment: otel.environment,
            version,
            time: new Date().toISOString(),
        },
    });
}
