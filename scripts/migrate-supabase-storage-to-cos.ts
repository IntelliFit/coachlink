/**
 * Supabase Storage → 腾讯云 COS 迁移工具
 *
 * 特性：
 * - 默认 dry-run（只统计、不上传）；加 --execute 才真正迁移
 * - 跳过已有：用 COS headObject 实时检测目标 key 是否存在且大小一致（不依赖本地状态文件，可重复运行）
 * - 失败可断点重跑（已成功上传的会被 skip）
 *
 * 对象清单来源：源库 storage.objects（经 service_role 绕过 RLS），key 即 object 的 name（完整 path）。
 * 文件内容：通过 Supabase Storage download API（service_role）下载后上传到 COS。
 *
 * 环境变量（见 .env.development）：
 *   NEXT_SUPABASE_URL / NEXT_SUPABASE_SERVICE_ROLE_KEY  —— 下载源文件
 *   SUPABASE_DB_PASSWORD / SOURCE_DB_HOST / SOURCE_DB_USER / ...  —— 读 storage.objects 清单
 *   COS_REGION / COS_SECRET_ID / COS_SECRET_KEY          —— 上传到 COS
 *
 * 用法：
 *   npm run migrate:storage-to-cos                 # dry-run 全部
 *   npm run migrate:storage-to-cos -- --execute    # 真正迁移
 *   npm run migrate:storage-to-cos -- --bucket=videos --execute
 *   npm run migrate:storage-to-cos -- --verify     # 只核对源 vs COS 数量
 *   npm run migrate:storage-to-cos -- --concurrency=6 --execute
 */

import dotenv from "dotenv";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import COS from "cos-nodejs-sdk-v5";
import pLimit from "p-limit";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development" });
dotenv.config();

const { Client } = pg;

type Mapping = {
  srcBucket: string;
  cosBucket: string;
  prefix: string;
};

/** 源 Supabase bucket → 目标 COS 桶 + key 前缀（合并桶用前缀避免冲突） */
const MAPPINGS: Mapping[] = [
  { srcBucket: "videos", cosBucket: "coachlink-videos-1370036754", prefix: "" },
  { srcBucket: "avatars", cosBucket: "coachlink-user-avatars-1370036754", prefix: "" },
  { srcBucket: "chat-images", cosBucket: "coachlink-chat-images-1370036754", prefix: "" },
  { srcBucket: "coach-posters", cosBucket: "coachlink-assets-1370036754", prefix: "coach-posters/" },
  { srcBucket: "knowledge-assets", cosBucket: "coachlink-assets-1370036754", prefix: "knowledge-assets/" },
  { srcBucket: "streetlifting-locations", cosBucket: "coachlink-assets-1370036754", prefix: "streetlifting-locations/" },
  { srcBucket: "receipts", cosBucket: "coachlink-receipts-1370036754", prefix: "receipts/" },
  { srcBucket: "payment-qrcodes", cosBucket: "coachlink-receipts-1370036754", prefix: "payment-qrcodes/" },
];

type CliOptions = {
  execute: boolean;
  verify: boolean;
  bucket?: string;
  concurrency: number;
};

type SourceObject = {
  name: string;
  size: number;
  mime: string | null;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function parseArgs(argv: string[]): CliOptions {
  const execute = argv.includes("--execute");
  const verify = argv.includes("--verify");
  const bucketArg = argv.find((a) => a.startsWith("--bucket="));
  const bucket = bucketArg?.split("=")[1];
  const concArg = argv.find((a) => a.startsWith("--concurrency="));
  const concurrency = Math.max(1, Number(concArg?.split("=")[1] || 4));
  return { execute, verify, bucket, concurrency };
}

function requireEnv(keys: string[]): void {
  const missing = keys.filter((k) => !env(k));
  if (missing.length) {
    throw new Error(`缺少环境变量: ${missing.join(", ")}（见 .env.development）`);
  }
}

function createSupabase(): SupabaseClient {
  const url = env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL")!;
  const key = env("NEXT_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function createCos(): COS {
  return new COS({
    SecretId: env("COS_SECRET_ID")!,
    SecretKey: env("COS_SECRET_KEY")!,
  });
}

async function connectSourcePg(): Promise<pg.Client> {
  const host = env("SOURCE_DB_HOST")!;
  const port = env("SOURCE_DB_PORT") || "5432";
  const name = env("SOURCE_DB_NAME") || "postgres";
  const user = env("SOURCE_DB_USER")!;
  const password = env("SOURCE_DB_PASSWORD") || env("SUPABASE_DB_PASSWORD")!;
  const client = new Client({
    host,
    port: Number(port),
    database: name,
    user,
    password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set role service_role");
  return client;
}

async function listSourceObjects(pgClient: pg.Client, srcBucket: string): Promise<SourceObject[]> {
  const { rows } = await pgClient.query<{ name: string; size: string | null; mime: string | null }>(
    `select name,
            (metadata->>'size') as size,
            coalesce(metadata->>'mimetype', metadata->>'contentType') as mime
       from storage.objects
      where bucket_id = $1 and name is not null
      order by name`,
    [srcBucket],
  );
  return rows.map((r) => ({
    name: r.name,
    size: r.size ? Number(r.size) : 0,
    mime: r.mime,
  }));
}

const cosRegion = () => env("COS_REGION") || "ap-beijing";

function cosHead(cos: COS, bucket: string, key: string): Promise<number | null> {
  return new Promise((resolve) => {
    cos.headObject({ Bucket: bucket, Region: cosRegion(), Key: key }, (err, data) => {
      if (err) {
        if (err.statusCode === 404) return resolve(null);
        return resolve(null);
      }
      resolve(Number(data.headers?.["content-length"] ?? data.ContentLength ?? -1));
    });
  });
}

function cosPut(cos: COS, bucket: string, key: string, body: Buffer, mime: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: cosRegion(),
        Key: key,
        Body: body,
        ContentLength: body.length,
        ...(mime ? { ContentType: mime } : {}),
      },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

async function cosCountPrefix(cos: COS, bucket: string, prefix: string): Promise<number> {
  let marker: string | undefined;
  let count = 0;
  for (;;) {
    const data: COS.GetBucketResult = await new Promise((resolve, reject) => {
      cos.getBucket(
        { Bucket: bucket, Region: cosRegion(), Prefix: prefix, Marker: marker, MaxKeys: 1000 },
        (err, d) => (err ? reject(err) : resolve(d)),
      );
    });
    count += (data.Contents || []).length;
    if (data.IsTruncated === "true" && data.NextMarker) marker = data.NextMarker;
    else break;
  }
  return count;
}

async function downloadFromSupabase(supabase: SupabaseClient, srcBucket: string, name: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(srcBucket).download(name);
  if (error || !data) throw new Error(`download ${srcBucket}/${name}: ${error?.message || "empty"}`);
  return Buffer.from(await data.arrayBuffer());
}

type BucketStat = {
  srcBucket: string;
  cosBucket: string;
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  bytes: number;
};

async function migrateBucket(
  m: Mapping,
  ctx: { pgClient: pg.Client; supabase: SupabaseClient; cos: COS; options: CliOptions },
): Promise<BucketStat> {
  const { pgClient, supabase, cos, options } = ctx;
  const objects = await listSourceObjects(pgClient, m.srcBucket);
  const stat: BucketStat = {
    srcBucket: m.srcBucket,
    cosBucket: m.cosBucket,
    total: objects.length,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    bytes: objects.reduce((s, o) => s + o.size, 0),
  };

  const limit = pLimit(options.concurrency);
  let done = 0;

  await Promise.all(
    objects.map((obj) =>
      limit(async () => {
        const key = m.prefix + obj.name;
        try {
          const existing = await cosHead(cos, m.cosBucket, key);
          const exists = existing !== null && (existing === obj.size || existing < 0);
          if (exists) {
            stat.skipped += 1;
          } else if (!options.execute) {
            // dry-run：仅计入待上传
            stat.uploaded += 1;
          } else {
            const buf = await downloadFromSupabase(supabase, m.srcBucket, obj.name);
            await cosPut(cos, m.cosBucket, key, buf, obj.mime);
            stat.uploaded += 1;
          }
        } catch (e) {
          stat.failed += 1;
          console.error(`  ✗ ${m.srcBucket}/${obj.name}: ${e instanceof Error ? e.message : e}`);
        } finally {
          done += 1;
          if (options.execute && done % 25 === 0) {
            console.log(`  ... ${m.srcBucket}: ${done}/${objects.length}`);
          }
        }
      }),
    ),
  );

  return stat;
}

async function verifyBucket(
  m: Mapping,
  ctx: { pgClient: pg.Client; cos: COS },
): Promise<void> {
  const objects = await listSourceObjects(ctx.pgClient, m.srcBucket);
  const cosCount = await cosCountPrefix(ctx.cos, m.cosBucket, m.prefix);
  const flag = cosCount >= objects.length ? "OK" : "MISMATCH";
  console.log(
    `${m.srcBucket.padEnd(26)} → ${m.cosBucket.padEnd(34)} src=${String(objects.length).padStart(5)} cos=${String(cosCount).padStart(5)}  ${flag}`,
  );
}

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireEnv([
    "NEXT_SUPABASE_URL",
    "NEXT_SUPABASE_SERVICE_ROLE_KEY",
    "COS_SECRET_ID",
    "COS_SECRET_KEY",
    "SOURCE_DB_HOST",
    "SOURCE_DB_USER",
  ]);

  const mappings = options.bucket ? MAPPINGS.filter((m) => m.srcBucket === options.bucket) : MAPPINGS;
  if (mappings.length === 0) throw new Error(`未知 --bucket=${options.bucket}`);

  const pgClient = await connectSourcePg();
  const supabase = createSupabase();
  const cos = createCos();

  console.log("CoachLink Supabase Storage → COS");
  console.log(`region=${cosRegion()} mode=${options.verify ? "VERIFY" : options.execute ? "EXECUTE" : "DRY-RUN"} concurrency=${options.concurrency}`);
  console.log("=".repeat(96));

  try {
    if (options.verify) {
      for (const m of mappings) await verifyBucket(m, { pgClient, cos });
      return;
    }

    const stats: BucketStat[] = [];
    for (const m of mappings) {
      console.log(`\n[${m.srcBucket}] → ${m.cosBucket}  (prefix='${m.prefix}')`);
      const s = await migrateBucket(m, { pgClient, supabase, cos, options });
      stats.push(s);
      const label = options.execute ? "uploaded" : "to-upload";
      console.log(`  total=${s.total} ${label}=${s.uploaded} skip(exists)=${s.skipped} failed=${s.failed} size=${fmtMB(s.bytes)}`);
    }

    console.log("\n" + "=".repeat(96));
    let tU = 0, tS = 0, tF = 0, tT = 0, tB = 0;
    for (const s of stats) { tU += s.uploaded; tS += s.skipped; tF += s.failed; tT += s.total; tB += s.bytes; }
    const label = options.execute ? "uploaded" : "to-upload";
    console.log(`汇总: total=${tT} ${label}=${tU} skip=${tS} failed=${tF} size=${fmtMB(tB)}`);
    if (!options.execute) console.log("\n提示: 确认后执行 npm run migrate:storage-to-cos -- --execute");
    else console.log("\n核对: npm run migrate:storage-to-cos -- --verify");
  } finally {
    await pgClient.end();
  }
}

main().catch((e) => {
  console.error("迁移失败:", e instanceof Error ? e.message : e);
  process.exit(1);
});
