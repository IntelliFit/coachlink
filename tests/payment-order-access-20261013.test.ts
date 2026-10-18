import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  session: null as any, order: null as any, read: vi.fn(), anon: vi.fn(), from: vi.fn(), gateway: vi.fn(),
}));
vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({ getServerSession: async () => state.session }));
vi.mock('@/lib/supabaseClient', () => ({
  default: { from: state.anon }, serviceRoleSupabase: { from: state.from },
}));
vi.mock('@/lib/alipaySdk', () => ({ createAlipaySdk: () => ({ exec: state.gateway }) }));
vi.mock('@/lib/huifuWebPayment', () => ({
  isHuifuWebPayment: () => false, assertHuifuWebPaymentAmount: vi.fn(), queryHuifuPaymentOrder: state.gateway,
}));
vi.mock('@/app/api/payment/alipay/fulfillPaidOrder', () => ({ fulfillSubscriptionAndMaybeCreditWallet: vi.fn() }));
vi.mock('@/app/api/payment/alipay/contentPurchaseFulfillment', () => ({ fulfillContentPurchasePaid: vi.fn() }));
import { POST } from '@/app/api/payment/alipay/query/route';
beforeEach(() => {
  vi.clearAllMocks(); state.session=null;
  state.order={id:'payment-1',user_id:'owner',order_type:'student_membership',status:'paid',total_amount:200,trade_status:'TRADE_SUCCESS'};
  state.anon.mockImplementation(() => { throw new Error('Financial rows must not use anon'); });
  state.from.mockImplementation(() => {
    const chain:any={select:()=>chain,eq:()=>chain,single:async()=>({data:state.order,error:null})};return chain;
  });
});
const req=()=>new Request('http://localhost/api/payment/alipay/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:'payment-1'})});
describe('server-only payment access and compatibility', () => {
  it('keeps an owner query working with private table access', async () => {
    state.session={user:{id:'owner'}};
    const response=await POST(req()); expect(response.status).toBe(200);
    expect((await response.json()).data.order.total_amount).toBe(2);
    expect(state.from).toHaveBeenCalledWith('alipay_orders');expect(state.anon).not.toHaveBeenCalled();
  });
  it.each(['student_membership','coach_subscription','content_purchase'])('rejects a different owner for %s before gateway/fulfillment', async type => {
    state.session={user:{id:'other'}};state.order.order_type=type;
    expect((await POST(req())).status).toBe(403);expect(state.gateway).not.toHaveBeenCalled();
  });
  it('rejects anonymous access to ordinary orders', async () => {
    expect((await POST(req())).status).toBe(401);expect(state.gateway).not.toHaveBeenCalled();
  });
  it('preserves guest checkout lookup without opening the underlying table', async () => {
    state.order.order_type='guest_content_purchase';
    expect((await POST(req())).status).toBe(200);expect(state.anon).not.toHaveBeenCalled();
  });
});
