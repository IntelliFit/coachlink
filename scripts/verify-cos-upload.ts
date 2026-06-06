/**
 * COS 上传链路验证脚本（一次性、幂等）
 *
 * 用真实的 cosUpload / buildDatedKey（与上传接口同一套逻辑）上传一个测试对象，
 * 校验：① 成功写入 COS；② key 含 年/月/日；③ 返回的 CDN URL 能 200 访问；
 * 最后删除测试对象，不留残留。
 *
 *   npx tsx scripts/verify-cos-upload.ts
 */
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";

dotenvConfig({ path: resolve(process.cwd(), ".env.development") });

async function purge() {
  const { getCos, BUCKET_MAP, COS_REGION } = await import("../src/lib/cos");
  const logicals = ["avatars", "chat-images", "coach-posters", "receipts"] as const;
  for (const logical of logicals) {
    const cfg = BUCKET_MAP[logical];
    const prefix = `${cfg.prefix}__verify__/`;
    const listed: { Key: string }[] = await new Promise((resolve, reject) => {
      getCos().getBucket(
        { Bucket: cfg.cosBucket, Region: COS_REGION, Prefix: prefix },
        (err, data) => (err ? reject(err) : resolve((data.Contents || []) as { Key: string }[])),
      );
    });
    if (listed.length === 0) {
      console.log(`[${logical}] 无 __verify__ 残留`);
      continue;
    }
    await new Promise<void>((resolve, reject) => {
      getCos().deleteMultipleObject(
        { Bucket: cfg.cosBucket, Region: COS_REGION, Objects: listed.map((o) => ({ Key: o.Key })) },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    console.log(`[${logical}] 已删除 ${listed.length} 个 __verify__ 对象`);
  }
}

async function main() {
  if (process.argv.includes("--purge")) {
    await purge();
    process.exit(0);
  }
  // 动态 import：确保 .env 已加载后再求值 cos.ts 顶层的 BUCKET_MAP
  const { cosUpload, cosRemove, buildDatedKey, BUCKET_MAP } = await import("../src/lib/cos");

  const targets: Array<{ logical: keyof typeof BUCKET_MAP; ext: string; ct: string }> = [
    { logical: "avatars", ext: "png", ct: "image/png" },
    { logical: "chat-images", ext: "png", ct: "image/png" },
    { logical: "coach-posters", ext: "png", ct: "image/png" }, // 验证合并桶 assets + 前缀
    { logical: "receipts", ext: "png", ct: "image/png" }, // 验证 receipts 公有+CDN
  ];

  // 1x1 透明 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  let ok = 0;
  let fail = 0;

  for (const t of targets) {
    const key = buildDatedKey(t.ext, "__verify__");
    const cfg = BUCKET_MAP[t.logical];
    console.log(`\n[${t.logical}] 桶=${cfg.cosBucket} 前缀=${cfg.prefix || "(无)"} cdn=${cfg.cdnBase || "(无,回退直链)"}`);
    console.log(`  key = ${key}`);

    try {
      const { url } = await cosUpload(t.logical, key, png, { contentType: t.ct });
      console.log(`  ✔ 上传成功，URL = ${url}`);

      const datePart = /\/(\d{4})\/(\d{2})\/(\d{2})\//.test(url);
      console.log(`  ${datePart ? "✔" : "✗"} URL 含 年/月/日 目录`);

      try {
        const res = await fetch(url, { method: "GET" });
        console.log(`  ${res.ok ? "✔" : "✗"} HTTP GET ${res.status} ${res.statusText}`);
        if (!res.ok) fail++;
        else ok++;
      } catch (e) {
        console.log(`  ✗ HTTP GET 失败（CDN 可能仍在部署/DNS 未生效）：${(e as Error).message}`);
        fail++;
      }

      if (process.argv.includes("--keep")) {
        console.log(`  ⏸ 保留测试对象（--keep）。清理命令：logical=${t.logical} key=${key}`);
      } else {
        await cosRemove(t.logical, [key]);
        console.log(`  ✔ 已清理测试对象`);
      }
    } catch (e) {
      console.log(`  ✗ 上传失败：${(e as Error).message}`);
      fail++;
    }
  }

  console.log(`\n==== 结果：成功 ${ok} / 失败 ${fail} ====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
