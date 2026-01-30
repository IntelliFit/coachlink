import type { CreateAlipayOrderDto, CreateAlipayOrderResponseDto } from '@/app/api/payment/alipay/create/entity';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto } from '@/app/api/payment/alipay/query/entity';
import { BaseService } from '@/lib/baseService';

class AlipayService extends BaseService {

    async createOrder(reqData: CreateAlipayOrderDto) {
        const res = await this.post<CreateAlipayOrderResponseDto>('create', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async queryOrder(reqData: QueryAlipayOrderDto) {
        const res = await this.post<QueryAlipayOrderResponseDto>('query', reqData);
        if (res.data?.success) {
            return res.data.data ?? null;
        }
        const msg = (res.data as { message?: string })?.message || '查询失败';
        throw new Error(msg);
    }
}

export const alipayService = new AlipayService('/api/payment/alipay');