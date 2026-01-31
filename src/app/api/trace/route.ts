import { NextResponse, type NextRequest } from "next/server";
import {
	MAX_ID_LENGTH,
	MAX_TEXT_LENGTH,
	TRACE_ENV,
	hasServiceRoleKey,
	safeText,
	shouldSkipTrace,
} from "@/app/api/trace/trace-common";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { Database } from "@/types/database.types";

type TraceEventInput = {
	event_type?: string;
	name?: string;
	path?: string;
	url?: string;
	referrer?: string;
	anon_id?: string;
	session_id?: string;
	trace_id?: string;
	method?: string;
	env?: string;
	from_path?: string;
	duration_ms?: number;
};

type TraceEventInsert = Omit<
	Database["public"]["Tables"]["admin_trace_events"]["Insert"],
	"properties"
> & {
	from_path?: string | null;
	duration_ms?: number | null;
};

const MAX_EVENTS_PER_REQUEST = 50;

function normalizePayload(body: unknown): TraceEventInput[] {
	if (Array.isArray(body)) return body as TraceEventInput[];
	if (body && typeof body === "object" && Array.isArray((body as any).events)) {
		return (body as any).events as TraceEventInput[];
	}
	return [body as TraceEventInput];
}

export async function POST(req: NextRequest) {
	if (!hasServiceRoleKey()) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "缺少 service role key，无法写入埋点" },
			{ status: 500 },
		);
	}

	if (shouldSkipTrace(req)) {
		return NextResponse.json<ApiData<{ ingested: number }>>({
			success: true,
			message: "skip in non-prod",
			data: { ingested: 0 },
		});
	}

	// 共享密钥（可选），便于内部调用；未提供时允许继续
	const sharedSecret = process.env.TRACE_SHARED_SECRET;
	const requestSecret = req.headers.get("x-trace-secret");

	const session = await getServerSession();
	const userId = session?.user?.id ?? null;
	if (sharedSecret && requestSecret !== sharedSecret && !userId) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "未授权" },
			{ status: 401 },
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch (_err) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "请求体不是有效的 JSON" },
			{ status: 400 },
		);
	}

	const userAgent = safeText(req.headers.get("user-agent"), MAX_TEXT_LENGTH);
	const referrerHeader = safeText(
		req.headers.get("referer") || req.headers.get("referrer"),
		MAX_TEXT_LENGTH,
	);

	const inputs = normalizePayload(body).slice(0, MAX_EVENTS_PER_REQUEST);
	const now = new Date().toISOString();

	const events: TraceEventInsert[] = [];
	for (const raw of inputs) {
		if (!raw || typeof raw !== "object") continue;

		const eventType = safeText(raw.event_type || raw.name, 64);
		const path = safeText(raw.path, MAX_TEXT_LENGTH);
		const url = safeText(raw.url, MAX_TEXT_LENGTH);
		const referrer = safeText(raw.referrer, MAX_TEXT_LENGTH) || referrerHeader;
		const anonId = safeText(raw.anon_id, MAX_ID_LENGTH);
		const sessionId = safeText(raw.session_id, MAX_ID_LENGTH);
		const traceId = safeText(raw.trace_id, MAX_ID_LENGTH);
		const method = safeText(raw.method, 16) || req.method;
		const fromPath = safeText(raw.from_path, MAX_TEXT_LENGTH);
		const durationMs = typeof raw.duration_ms === "number" ? raw.duration_ms : null;

		if (!eventType) continue;

		events.push({
			event_type: eventType,
			path,
			url,
			referrer,
			user_id: userId,
			anon_id: anonId,
			session_id: sessionId,
			user_agent: userAgent,
			created_at: now,
			trace_id: traceId,
			env: TRACE_ENV,
			method,
			from_path: fromPath,
			duration_ms: durationMs,
		});
	}

	if (events.length === 0) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "没有可写入的事件" },
			{ status: 400 },
		);
	}

	const { error } = await serviceRoleSupabase.from("admin_trace_events").insert(events);
	if (error) {
		console.error("写入 admin_trace_events 失败", error);
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "写入失败" },
			{ status: 500 },
		);
	}

	return NextResponse.json<ApiData<{ ingested: number }>>({
		success: true,
		message: "ok",
		data: { ingested: events.length },
	});
}

export async function PUT(req: NextRequest) {
	if (!hasServiceRoleKey()) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "缺少 service role key，无法写入埋点" },
			{ status: 500 },
		);
	}

	if (shouldSkipTrace(req)) {
		return NextResponse.json<ApiData<{ updated: number }>>({
			success: true,
			message: "skip in non-prod",
			data: { updated: 0 },
		});
	}

	const sharedSecret = process.env.TRACE_SHARED_SECRET;
	const requestSecret = req.headers.get("x-trace-secret");

	const session = await getServerSession();
	const userId = session?.user?.id ?? null;
	if (sharedSecret && requestSecret !== sharedSecret && !userId) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "未授权" },
			{ status: 401 },
		);
	}

	let body: any;
	try {
		body = await req.json();
	} catch (_err) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "请求体不是有效的 JSON" },
			{ status: 400 },
		);
	}

	const traceId = safeText(body?.trace_id, MAX_ID_LENGTH);
	if (!traceId) {
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "缺少 trace_id" },
			{ status: 400 },
		);
	}

	const leaveAt = safeText(body?.leave_at, MAX_TEXT_LENGTH) || new Date().toISOString();
	const durationMs = typeof body?.duration_ms === "number" ? body.duration_ms : null;

	const { error, data } = await serviceRoleSupabase
		.from("admin_trace_events")
		.update({ leave_at: leaveAt, duration_ms: durationMs })
		.eq("trace_id", traceId)
		.select("id");

	if (error) {
		console.error("更新 admin_trace_events 失败", error);
		return NextResponse.json<ApiData<null>>(
			{ success: false, message: "更新失败" },
			{ status: 500 },
		);
	}

	return NextResponse.json<ApiData<{ updated: number }>>({
		success: true,
		message: "ok",
		data: { updated: data?.length ?? 0 },
	});
}
