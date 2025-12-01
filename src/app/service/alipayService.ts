import { supabase } from '../lib/supabaseClient';

// 支付宝支付相关类型定义
export interface AlipayOrder {
  id: string;
  out_trade_no: string;
  subject: string;
  total_amount: number;
  product_code: string;
  qr_code?: string;
  payment_url?: string;
  trade_no?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  user_id: string;
  order_type: 'subscription' | 'product' | 'service';
  order_data: any;
}

export interface CreateOrderRequest {
  subject: string;
  total_amount: number;
  order_type: 'subscription' | 'product' | 'service';
  order_data: any;
  user_id: string;
}

export interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  signType?: string;
  charset?: string;
  version?: string;
}

class AlipayService {
  private config: AlipayConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // 从环境变量或配置文件加载支付宝配置
    this.config = {
      appId: import.meta.env.VITE_ALIPAY_APP_ID || '',
      privateKey: import.meta.env.VITE_ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: import.meta.env.VITE_ALIPAY_PUBLIC_KEY || '',
      gateway: import.meta.env.VITE_ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    };
  }

  /**
   * 创建支付订单
   */
  async createOrder(request: CreateOrderRequest): Promise<AlipayOrder> {
    try {
      // 生成订单号
      const out_trade_no = this.generateOrderNo();
      
      // 调用后端 API 创建订单
      const { data, error } = await supabase.functions.invoke('create-alipay-order', {
        body: {
          out_trade_no,
          subject: request.subject,
          total_amount: request.total_amount,
          order_type: request.order_type,
          order_data: request.order_data,
          user_id: request.user_id
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.order;
    } catch (error) {
      console.error('创建支付订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取支付二维码
   */
  async getPaymentQRCode(orderId: string): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('get-alipay-qrcode', {
        body: { order_id: orderId } // 这里传递的实际上是 out_trade_no
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.qr_code;
    } catch (error) {
      console.error('获取支付二维码失败:', error);
      throw error;
    }
  }

  /**
   * 查询订单状态
   */
  async queryOrderStatus(orderId: string): Promise<AlipayOrder> {
    try {
      const { data, error } = await supabase.functions.invoke('query-alipay-order', {
        body: { order_id: orderId }
      });

      if (error) {
        console.error('❌ 查询订单API错误:', error);
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || '查询订单失败');
      }

      return data.order;
    } catch (error) {
      console.error('查询订单状态失败:', error);
      throw error;
    }
  }

  /**
   * 查询订单（queryOrderStatus的别名）
   */
  async queryOrder(orderId: string): Promise<AlipayOrder> {
    return this.queryOrderStatus(orderId);
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('cancel-alipay-order', {
        body: { order_id: orderId }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.success;
    } catch (error) {
      console.error('取消订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: string, limit: number = 10, offset: number = 0): Promise<AlipayOrder[]> {
    try {
      const { data, error } = await supabase.functions.invoke('get-user-orders', {
        body: { user_id: userId, limit, offset }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.orders || [];
    } catch (error) {
      console.error('获取用户订单失败:', error);
      throw error;
    }
  }

  /**
   * 生成订单号
   */
  private generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ALIPAY_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * 验证支付回调
   */
  async verifyPaymentCallback(callbackData: any): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('verify-alipay-callback', {
        body: callbackData
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.verified;
    } catch (error) {
      console.error('验证支付回调失败:', error);
      throw error;
    }
  }
}

export const alipayService = new AlipayService();
