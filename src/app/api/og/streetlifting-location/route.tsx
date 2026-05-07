import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function decodeParam(value: string | null, fallback = "") {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function trimText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const name = trimText(
      decodeParam(searchParams.get("name"), "发现单杠训练点"),
      28,
    );
    const area = trimText(
      decodeParam(searchParams.get("area"), "打开 CoachLink 查看这个单杠点位"),
      40,
    );
    const description = trimText(
      decodeParam(searchParams.get("description"), "查看图片、地址、导航与现场描述"),
      60,
    );
    const imageUrl = decodeParam(searchParams.get("image"), "").trim();

    return new ImageResponse(
      (
        <div
          style={{
            width: "1080px",
            height: "1440px",
            display: "flex",
            flexDirection: "column",
            background: "#F6EFEA",
            color: "#1F2937",
            position: "relative",
            overflow: "hidden",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0",
              background:
                "radial-gradient(circle at top left, rgba(207,109,78,0.22), transparent 38%), radial-gradient(circle at bottom right, rgba(17,24,39,0.08), transparent 34%)",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "64px 72px 40px",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#CF6D4E",
                }}
              >
                COACHLINK TOOLBOX
              </span>
              <span
                style={{
                  marginTop: "10px",
                  fontSize: "22px",
                  color: "#6B7280",
                }}
              >
                单杠地图分享
              </span>
            </div>
            <div
              style={{
                display: "flex",
                padding: "14px 24px",
                borderRadius: "999px",
                background: "#CF6D4E",
                color: "#FFFFFF",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              小程序内查看
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "0 72px 72px",
              gap: "32px",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "40px",
                borderRadius: "40px",
                background: "rgba(255,255,255,0.82)",
                border: "1px solid rgba(207,109,78,0.14)",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  color: "#9CA3AF",
                  marginBottom: "20px",
                }}
              >
                发现训练点
              </span>
              <span
                style={{
                  fontSize: "66px",
                  lineHeight: 1.12,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {name}
              </span>
              <span
                style={{
                  marginTop: "24px",
                  fontSize: "30px",
                  lineHeight: 1.5,
                  color: "#4B5563",
                }}
              >
                {area}
              </span>
              <span
                style={{
                  marginTop: "20px",
                  fontSize: "26px",
                  lineHeight: 1.6,
                  color: "#6B7280",
                }}
              >
                {description}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                borderRadius: "44px",
                overflow: "hidden",
                background: "#E5E7EB",
                border: "1px solid rgba(17,24,39,0.06)",
                position: "relative",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      "linear-gradient(135deg, rgba(207,109,78,0.18), rgba(255,255,255,0.9))",
                    color: "#CF6D4E",
                    fontSize: "40px",
                    fontWeight: 700,
                  }}
                >
                  暂无现场图片
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  left: "28px",
                  bottom: "28px",
                  display: "flex",
                  padding: "12px 20px",
                  borderRadius: "999px",
                  background: "rgba(17,24,39,0.66)",
                  color: "#FFFFFF",
                  fontSize: "22px",
                  fontWeight: 600,
                }}
              >
                去小程序看地址与导航
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1440,
      },
    );
  } catch (error) {
    console.error("[og][streetlifting-location] failed", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
