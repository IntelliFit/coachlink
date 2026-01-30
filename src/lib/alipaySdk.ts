import { AlipaySdk } from 'alipay-sdk';
import { ProxyAgent } from 'urllib';

/**
 * 创建支付宝 SDK 实例，支持代理配置
 *
 * 代理通过环境变量 ALIPAY_PROXY 或 HTTPS_PROXY 设置
 * 格式: http://username:password@host:port
 *
 * 注意：密码中特殊字符（!、@、# 等）需 URL 编码，如 ! → %21
 */
export function createAlipaySdk() {
    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY,
        ALIPAY_PROXY,
        HTTPS_PROXY,
        HTTP_PROXY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        throw new Error('支付宝配置不完整：缺少 APP_ID、PRIVATE_KEY 或 PUBLIC_KEY');
    }

    const proxyUrl = ALIPAY_PROXY || HTTPS_PROXY || HTTP_PROXY;

    const sdkConfig: Record<string, unknown> = {
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    };

    if (proxyUrl && typeof window === 'undefined') {
        sdkConfig.proxyAgent = new ProxyAgent(proxyUrl);
        const masked = proxyUrl.replace(/:[^:]*@/, ':****@');
        console.log(`[Alipay SDK] 使用代理: ${masked}`);
    }

    return new AlipaySdk(sdkConfig as any);
}
