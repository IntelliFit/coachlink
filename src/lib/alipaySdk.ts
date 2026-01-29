import { AlipaySdk } from 'alipay-sdk';

/**
 * 创建支付宝 SDK 实例，支持代理配置
 * 
 * 代理配置通过环境变量 ALIPAY_PROXY 设置
 * 格式: http://username:password@host:port
 * 
 * 注意：
 * 1. 如果密码中包含特殊字符（如 !、@、# 等），需要进行 URL 编码
 *    例如：! 应该编码为 %21，@ 应该编码为 %40
 * 2. 代理环境变量会在应用启动时（scripts/start-dev.mjs）自动设置
 *    这样 alipay-sdk 内部的所有 HTTP 请求都会通过代理服务器
 * 3. 如果不需要代理，只需在环境变量文件中注释掉或删除 ALIPAY_PROXY
 */
export function createAlipaySdk() {
    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY,
        ALIPAY_PROXY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        throw new Error('支付宝配置不完整：缺少 APP_ID、PRIVATE_KEY 或 PUBLIC_KEY');
    }

    // 如果配置了代理，记录日志（代理环境变量已在启动时设置）
    if (ALIPAY_PROXY && typeof window === 'undefined') {
        const maskedProxy = ALIPAY_PROXY.replace(/:[^:]*@/, ':****@');
        console.log(`[Alipay SDK] 使用代理: ${maskedProxy}`);
    }

    // 创建支付宝 SDK 实例
    // Node.js 的 https/http 模块会自动读取 HTTPS_PROXY 和 HTTP_PROXY 环境变量
    const sdkConfig: any = {
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    };

    return new AlipaySdk(sdkConfig);
}
