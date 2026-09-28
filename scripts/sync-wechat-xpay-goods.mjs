import crypto from "node:crypto";
import { bootstrapEnv } from "./config/bootstrap-env.mjs";

const apply = process.argv.includes("--apply");
const mode = process.argv.includes("--production") ? "production" : (process.env.NODE_ENV || "development");
await bootstrapEnv({ mode });

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function positiveInt(value, fallback) {
  const parsed = Math.round(Number(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function productId(prefix, price) {
  const value = `${prefix}_${price}`;
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(value)) throw new Error(`Invalid XPay product id: ${value}`);
  return value;
}

const env = String(process.env.WECHAT_XPAY_SANDBOX || "").toLowerCase() === "true" ? 1 : 0;
const testPricing = process.env.NODE_ENV !== "production" && process.env.PAYMENT_TEST_PRICING === "true";
const imageUrl = "https://coachlink.fit/coachlink.jpg";
const membership = testPricing
  ? [
      ["m_basic", 1, "CoachLink基础月卡"],
      ["m_premium", 2, "CoachLink高级月卡"],
      ["ai_pack", 1, "AI导入加油包"],
      ["storage", 1, "存储扩容包"],
    ]
  : [
      ["m_basic", 1990, "CoachLink基础月卡"],
      ["m_premium", 3990, "CoachLink高级月卡"],
      ["ai_pack", 200, "AI导入加油包"],
      ["storage", 990, "存储扩容包"],
    ];

const standard = positiveInt(process.env.MOTION_EFFECTS_STANDARD_PRICE_CENTS, 290);
const hd = positiveInt(process.env.MOTION_EFFECTS_HD_PRICE_CENTS, 490);
const priority = positiveInt(process.env.MOTION_EFFECTS_PRIORITY_ADDON_CENTS, 190);
const goods = membership.map(([prefix, price, name]) => ({
  id: productId(prefix, price),
  name,
  price,
  remark: `CoachLink 小程序虚拟商品：${name}`,
  item_url: imageUrl,
}));

for (const price of new Set([standard, hd, standard + priority, hd + priority])) {
  goods.push({
    id: productId("motion_p", price),
    name: "动作特效导出",
    price,
    remark: "CoachLink 动作特效数字内容导出服务",
    item_url: imageUrl,
  });
}

const uniqueGoods = [...new Map(goods.map((item) => [item.id, item])).values()];
console.log(JSON.stringify({ env, count: uniqueGoods.length, goods: uniqueGoods }, null, 2));
if (!apply) {
  console.log("Dry run only. Re-run with --apply after checking the manifest.");
  process.exit(0);
}

const appId = required("WECHAT_MINIAPP_APPID");
const appSecret = required("WECHAT_MINIAPP_SECRET");
const appKey = required("WECHAT_XPAY_APP_KEY");
const tokenResponse = await fetch(
  `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
);
const tokenBody = await tokenResponse.json();
if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(tokenBody.errmsg || "Failed to fetch access token");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function xpay(path, payload) {
  const body = JSON.stringify(payload);
  const paySig = crypto.createHmac("sha256", appKey).update(`${path}&${body}`).digest("hex");
  const response = await fetch(
    `https://api.weixin.qq.com${path}?access_token=${encodeURIComponent(tokenBody.access_token)}&pay_sig=${paySig}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );
  const result = await response.json();
  // A running batch (268490012) may belong to another operator. Failing fast
  // is safer than polling that unrelated task and silently skipping this SKU.
  if (!response.ok || Number(result.errcode || 0) !== 0) {
    throw new Error(`${path}: ${result.errcode || response.status} ${result.errmsg || response.statusText}`);
  }
  return result;
}

async function waitTask(path, field) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const result = await xpay(path, { env });
    if (Number(result.status) !== 1) {
      const items = Array.isArray(result[field]) ? result[field] : [];
      const failed = items.filter((item) => ![1, 2].includes(Number(item.upload_status ?? item.publish_status)));
      if (Number(result.status) === 3 || (Number(result.status) === 2 && failed.length === 0)) return result;
      throw new Error(`${path} failed: ${JSON.stringify(result)}`);
    }
    await sleep(2000);
  }
  throw new Error(`${path} timed out`);
}

for (const item of uniqueGoods) {
  await xpay("/xpay/start_upload_goods", { upload_item: [item], env });
  await waitTask("/xpay/query_upload_goods", "upload_item");
  await xpay("/xpay/start_publish_goods", { publish_item: [{ id: item.id }], env });
  await waitTask("/xpay/query_publish_goods", "publish_item");
  console.log(`Published ${item.id} (${item.price} fen)`);
}

console.log(`Published ${uniqueGoods.length} XPay goods.`);
