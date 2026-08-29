import type { UserConfigExport } from "@tarojs/cli";
import { networkInterfaces } from "os";

/** 虚拟/代理网段，需排除（如 Clash 会创建 198.18.x.x 的虚拟网卡） */
const VIRTUAL_IP_PREFIXES = ["198.18.", "198.19.", "169.254."];

function isVirtualIP(addr: string): boolean {
  return VIRTUAL_IP_PREFIXES.some((p) => addr.startsWith(p));
}

/** 获取本机局域网 IP，用于真机调试时手机访问电脑上的后端 */
function getLocalIP(): string | null {
  const nets = networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(nets)) {
    const ifaces = nets[name];
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal && iface.address) {
        if (isVirtualIP(iface.address)) continue; // 排除 Clash 等代理的虚拟网卡
        candidates.push(iface.address);
      }
    }
  }
  // 优先返回 192.168/10 等常见局域网段
  const preferred = candidates.find((a) => a.startsWith("192.168.") || a.startsWith("10."));
  return preferred ?? candidates[0] ?? null;
}

/** 开发环境 API 地址：默认优先 localhost（DevTools 模拟器），真机调试再显式切 LAN */
function getDevApiUrl(): string {
  // 可通过环境变量强制指定，如: TARO_APP_API_URL=http://127.0.0.1:3000 pnpm dev:weapp
  const envUrl = process.env.TARO_APP_API_URL;
  if (envUrl) return envUrl;
  const port = process.env.PORT || "3000";
  // 默认本地调试走 localhost，只有明确需要真机调试时才切到局域网 IP。
  const useLocalhost = process.env.USE_LOCALHOST === "1" || process.env.USE_LOCALHOST === "true";
  if (useLocalhost) return `http://localhost:${port}`;
  const useLan = process.env.USE_LAN === "1" || process.env.USE_LAN === "true";
  if (!useLan) return `http://localhost:${port}`;
  const ip = getLocalIP();
  return ip ? `http://${ip}:${port}` : `http://localhost:${port}`;
}

function getDevApiUrlSafe(): string {
  try {
    return getDevApiUrl();
  } catch {
    return "http://localhost:3000";
  }
}

const devApiUrl = process.env.NODE_ENV === "development" ? getDevApiUrlSafe() : "http://localhost:3000";
const releaseApiUrl = process.env.TARO_APP_API_BASE_URL_RELEASE || "https://coachlink.fit";
const trialApiUrl = process.env.TARO_APP_API_BASE_URL_TRIAL || "https://dev.coachlink.fit";
const developApiUrl = process.env.TARO_APP_API_BASE_URL_DEVELOP || devApiUrl;
const apiBaseUrlOverride =
  process.env.TARO_APP_API_BASE_URL_OVERRIDE || process.env.TARO_APP_API_URL || "";
if (process.env.NODE_ENV === "development") {
  console.log(
    "📱 小程序开发 API 地址:",
    devApiUrl,
    devApiUrl.includes("127.0.0.1") ? "(本地模拟器模式)" : "(局域网真机模式)"
  );
}

export default {
  defineConstants: {
    TARO_APP_API_URL: JSON.stringify(developApiUrl),
    __API_BASE_URL_RELEASE__: JSON.stringify(releaseApiUrl),
    __API_BASE_URL_TRIAL__: JSON.stringify(trialApiUrl),
    __API_BASE_URL_DEVELOP__: JSON.stringify(developApiUrl),
    __API_BASE_URL_OVERRIDE__: JSON.stringify(apiBaseUrlOverride),
    __DEV_MODE__: JSON.stringify(true)
  },
  mini: {},
  h5: {
    // 10086 常被本机其他工具占用，H5 调试固定走 10087
    devServer: {
      port: 10087,
      host: '0.0.0.0'
    }
  }
} satisfies UserConfigExport<'vite'>
