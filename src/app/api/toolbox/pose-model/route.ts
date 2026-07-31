const MODEL_URL =
  "https://raw.githubusercontent.com/Kazuhito00/MoveNet-Python-Example/515743a113e49b4f31677b1f6252c0041f237e30/onnx/movenet_singlepose_lightning_4.onnx";
const MODEL_SIZE = 9_466_715;

export const runtime = "nodejs";

export async function GET() {
  const upstream = await fetch(MODEL_URL, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { success: false, message: "人体关键点模型暂时不可用" },
      { status: 502 },
    );
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength && contentLength !== MODEL_SIZE) {
    return Response.json(
      { success: false, message: "人体关键点模型校验失败" },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "public, max-age=2592000, immutable",
      "Content-Disposition": 'attachment; filename="coachlink-movenet-lightning-v4.onnx"',
      "Content-Length": String(MODEL_SIZE),
      "Content-Type": "application/octet-stream",
    },
  });
}
