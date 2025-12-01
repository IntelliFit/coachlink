import type { CreateAlipayOrderDto, CreateAlipayOrderResponseDto } from '@/app/api/payment/alipay/create/entity';
import type { GetAlipayQrcodeDto, GetAlipayQrcodeResponseDto } from '@/app/api/payment/alipay/get-qrcode/entity';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto } from '@/app/api/payment/alipay/query/entity';
import { BaseService } from '@/lib/baseService';

class PaymentService extends BaseService {

    // Alipay specific methods
    async createAlipayOrder(reqData: CreateAlipayOrderDto) {
        const res = await this.post<CreateAlipayOrderResponseDto>('payment/alipay/create', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getAlipayQrcode(reqData: GetAlipayQrcodeDto) {
        const res = await this.post<GetAlipayQrcodeResponseDto>('payment/alipay/get-qrcode', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async queryAlipayOrder(reqData: QueryAlipayOrderDto) {
        const res = await this.post<QueryAlipayOrderResponseDto>('payment/alipay/query', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }
}

const paymentService = new PaymentService('/api/payment');
export default paymentService;