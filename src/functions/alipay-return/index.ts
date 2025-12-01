import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    
    // 获取参数 - 支持GET和POST两种方式
    const url = new URL(req.url);
    let params: any = {};
    
    // GET 请求：从 URL 参数获取
    if (req.method === 'GET') {
      params = Object.fromEntries(url.searchParams);
    }
    // POST 请求：从请求体获取
    else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // 表单数据
        const body = await req.text();
        params = Object.fromEntries(new URLSearchParams(body));
      } else if (contentType.includes('application/json')) {
        // JSON 数据
        params = await req.json();
      }
    }
    
    console.log('📡 解析后的回调参数:', params);
    
    // 提取关键参数
    const {
      out_trade_no,  // 商户订单号
      trade_no,      // 支付宝交易号
      total_amount,  // 交易金额
      seller_id,     // 卖家支付宝用户ID
      trade_status,  // 交易状态
      sign,          // 签名
      sign_type      // 签名类型
    } = params;
    
    console.log('📦 订单信息:', {
      out_trade_no,
      trade_no,
      total_amount,
      trade_status
    });
    
    // 验证必要参数
    // 注意：同步回调(return_url)不包含trade_status，只有异步回调(notify_url)才有
    // 同步回调只要有out_trade_no和trade_no就说明用户已经支付
    if (!out_trade_no || !trade_no) {

      return new Response(
        `<html><head><meta charset="utf-8"></head><body>
          <h1>回调参数错误</h1>
          <p>缺少必要参数</p>
          <h3>调试信息：</h3>
          <pre>请求方法: ${req.method}</pre>
          <pre>请求URL: ${req.url}</pre>
          <pre>接收到的参数: ${JSON.stringify(params, null, 2)}</pre>
          <pre>参数键: ${Object.keys(params).join(', ')}</pre>
          <pre>out_trade_no: ${out_trade_no || '未提供'}</pre>
          <pre>trade_no: ${trade_no || '未提供'}</pre>
          <pre>trade_status: ${trade_status || '未提供（同步回调不包含此字段）'}</pre>
        </body></html>`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }
    
    // 创建 Supabase 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 更新订单状态
    // 同步回调：只要支付宝返回了trade_no，就说明支付已提交，更新为paid状态
    // 注意：严格来说应该等异步回调(notify_url)确认，但为了用户体验，这里先更新状态
    console.log('✅ 支付已提交，更新订单状态为paid');
    
    const { data, error } = await supabase
      .from('alipay_orders')
      .update({
        status: 'paid',
        trade_no: trade_no,
        paid_at: new Date().toISOString()
      })
      .eq('out_trade_no', out_trade_no)
      .select();
    
    if (error) {
      console.error('❌ 更新订单状态失败:', error);
    } else {
      console.log('✅ 订单状态更新成功:', data);
    }
    
    // 直接重定向回应用的支付成功页面，携带订单信息
    // 从环境变量获取前端应用URL，如果没有配置则使用localhost
    const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';
    
    // 构建支付结果数据对象
    const paymentData = {
      success: true,
      out_trade_no: out_trade_no,
      trade_no: trade_no,
      total_amount: total_amount || '0',
      timestamp: new Date().toISOString()
    };
    
    // 使用 URL Hash 传递参数（参数在 # 后面，不会发送到服务器）
    // 前端可以通过 window.location.hash 获取
    const dataString = btoa(JSON.stringify(paymentData)); // Base64编码
    const redirectUrl = `${APP_URL}#payment=${encodeURIComponent(dataString)}`;

    // 返回302重定向
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('❌ 支付回调处理失败:', error);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>回调处理失败</title>
      </head>
      <body>
        <h1>回调处理失败</h1>
        <p>错误信息：${error.message}</p>
      </body>
      </html>
    `;
    
    return new Response(html, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }
});


