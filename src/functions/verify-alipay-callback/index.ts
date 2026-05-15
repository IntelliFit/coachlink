import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  return new Response(JSON.stringify({
    success: false,
    verified: false,
    error: "Deprecated payment callback. Use /api/payment/alipay/notify with signature verification.",
  }), {
    status: 410,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
