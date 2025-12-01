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
    // 创建 Supabase 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 尝试从请求体获取参数
    let tradeNo;
    let requestBody = null;
    
    try {
      if (req.method === 'POST') {
        requestBody = await req.json();
        tradeNo = requestBody.order_id || requestBody.out_trade_no || requestBody.trade_no;
      } else if (req.method === 'GET') {
        // 尝试从URL参数获取
        const url = new URL(req.url);
        tradeNo = url.searchParams.get('order_id') || url.searchParams.get('out_trade_no') || url.searchParams.get('trade_no');
      }
    } catch (bodyError) {
      console.error('❌ 请求体解析失败:', bodyError);
    }
    
    if (!tradeNo) {
      return new Response(JSON.stringify({
        success: false,
        error: '订单交易号不能为空',
        debug: {
          method: req.method,
          requestBody,
          message: '请提供 order_id 或 out_trade_no 参数'
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 直接按 out_trade_no 查询
    const { data: order, error: orderError } = await supabase
      .from('alipay_orders')
      .select('*')
      .eq('out_trade_no', tradeNo)
      .single();

    // 如果查不到，列出最近的订单
    if (orderError || !order) {
      const { data: recentOrders, error: recentError } = await supabase
        .from('alipay_orders')
        .select('id, out_trade_no, subject, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      return new Response(JSON.stringify({
        success: false,
        error: '订单不存在',
        debug: {
          searchedTradeNo: tradeNo,
          searchError: orderError?.message,
          recentOrders: recentOrders || []
        }
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 检查订单状态
    if (order.status !== 'pending') {
      return new Response(JSON.stringify({
        success: false,
        error: '订单状态不允许生成二维码',
        orderStatus: order.status,
        message: `订单当前状态: ${order.status}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 如果订单已经有二维码，直接返回
    if (order.qr_code) {
      return new Response(JSON.stringify({
        success: true,
        qr_code: order.qr_code,
        order_id: order.id,
        out_trade_no: order.out_trade_no,
        message: '二维码获取成功'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 如果没有二维码，返回错误
    return new Response(JSON.stringify({
      success: false,
      error: '订单尚未生成二维码',
      orderInfo: {
        id: order.id,
        out_trade_no: order.out_trade_no,
        status: order.status
      }
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ 处理请求时发生错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '服务器内部错误',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});