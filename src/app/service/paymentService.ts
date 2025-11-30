import type {
    CreatePaymentDto,
    CreatePaymentResponseDto,
    VerifyPaymentDto,
    VerifyPaymentResponseDto,
    RefundPaymentDto,
    RefundPaymentResponseDto
} from '@/app/api/pay/entity';
import type {
    GetPaymentDto,
    GetPaymentResponseDto
} from '@/app/api/payment/get/entity';
import { BaseService } from '@/lib/baseService';

class PaymentService extends BaseService {
    async createPayment(reqData: CreatePaymentDto) {
        const res = await this.post<CreatePaymentResponseDto>('pay', reqData);
        return res.data;
    }

    async getPayment(reqData: GetPaymentDto) {
        const res = await this.post<GetPaymentResponseDto>('pay/get', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async verifyPayment(reqData: VerifyPaymentDto) {
        const res = await this.post<VerifyPaymentResponseDto>('pay/verify', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async refundPayment(reqData: RefundPaymentDto) {
        const res = await this.post<RefundPaymentResponseDto>('pay/refund', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }
}

const paymentService = new PaymentService('/api/payment');
export default paymentService;