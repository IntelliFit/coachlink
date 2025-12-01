import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS 头定义
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

Deno.serve(async (req) => {
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const callbackData = await req.json();

    if (!callbackData) {
      return new Response(JSON.stringify({
        success: false,
        error: '回调数据不能为空'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 这里应该验证支付宝回调的签名
    // 由于没有实际的支付宝配置，我们暂时返回验证成功
    // 在实际生产环境中，需要验证签名确保回调的真实性

    const { out_trade_no, trade_status } = callbackData;

    if (!out_trade_no) {
      return new Response(JSON.stringify({
        success: false,
        error: '订单号不能为空'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 根据支付宝回调状态更新订单
    let orderStatus = 'pending';
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      orderStatus = 'paid';
    } else if (trade_status === 'TRADE_CLOSED') {
      orderStatus = 'cancelled';
    }

    // 更新订单状态
    const { error: updateError } = await supabase
      .from('alipay_orders')
      .update({
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('out_trade_no', out_trade_no);

    if (updateError) {
      console.error('更新订单状态失败:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: '更新订单状态失败'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      message: '回调验证成功'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('处理请求时发生错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '服务器内部错误'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});


