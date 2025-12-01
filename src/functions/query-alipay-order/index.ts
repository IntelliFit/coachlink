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

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({
        success: false,
        error: '订单ID不能为空'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 获取订单信息 - 智能判断是ID还是out_trade_no
    let order, orderError;
    
    // 判断order_id是数字还是字符串（如果是ALIPAY_开头，则是out_trade_no）
    const isTradeNo = typeof order_id === 'string' && order_id.startsWith('ALIPAY_');
    
    if (isTradeNo) {
      const result = await supabase
        .from('alipay_orders')
        .select('*')
        .eq('out_trade_no', order_id)
        .single();
      order = result.data;
      orderError = result.error;
    } else {
      const result = await supabase
        .from('alipay_orders')
        .select('*')
        .eq('id', order_id)
        .single();
      order = result.data;
      orderError = result.error;
      
      // 如果按ID查不到，尝试按out_trade_no查询
      if (orderError) {
        const tradeNoResult = await supabase
          .from('alipay_orders')
          .select('*')
          .eq('out_trade_no', order_id)
          .single();
        
        if (tradeNoResult.data) {
          order = tradeNoResult.data;
          orderError = null;
        } else {
          orderError = tradeNoResult.error;
        }
      }
    }

    if (orderError || !order) {
      return new Response(JSON.stringify({
        success: false,
        error: '订单不存在',
        debug: orderError?.message
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }


    // 检查订单是否过期（15分钟）
    const orderTime = new Date(order.created_at);
    const now = new Date();
    const timeDiff = now.getTime() - orderTime.getTime();
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff > 15 && order.status === 'pending') {
      // 订单超时，更新状态
      const { error: updateError } = await supabase
        .from('alipay_orders')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (!updateError) {
        order.status = 'expired';
        order.updated_at = new Date().toISOString();
      } else {
        console.error('❌ 更新订单状态失败:', updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        out_trade_no: order.out_trade_no,
        subject: order.subject,
        total_amount: order.total_amount,
        status: order.status,
        trade_status: order.trade_status,
        qr_code: order.qr_code,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    }), {
      status: 200,
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
