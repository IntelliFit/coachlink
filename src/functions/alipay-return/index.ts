import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function readOutTradeNo(req: Request) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    return String(url.searchParams.get("out_trade_no") || "").trim();
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await req.text();
    return String(new URLSearchParams(body).get("out_trade_no") || "").trim();
  }
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({})) as { out_trade_no?: string };
    return String(body.out_trade_no || "").trim();
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const outTradeNo = await readOutTradeNo(req);
  if (!outTradeNo) {
    return new Response("missing out_trade_no", {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appUrl}/payment/${encodeURIComponent(outTradeNo)}`,
      ...corsHeaders,
    },
  });
});
