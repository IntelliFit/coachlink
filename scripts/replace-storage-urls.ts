/**
 * 批量替换数据库中历史 Supabase Storage URL → 腾讯云 COS CDN URL
 *
 * - 自动发现 public schema 下所有可能包含 URL 的列（text / varchar / json / jsonb）
 * - 仅处理实际包含 Supabase storage 前缀的列
 * - 默认 dry-run（只统计每个表.列命中行数，不改库）；加 --execute 才真正更新
 * - 幂等：替换后旧前缀消失，重复运行不会重复改动
 *
 * 数据库仍在 Supabase（用户暂不迁移 DB）。本脚本连接 Supabase 源库，set role service_role 以获写权限。
 *
 * 环境变量（见 .env.development）：
 *   SOURCE_DB_HOST / SOURCE_DB_PORT / SOURCE_DB_NAME / SOURCE_DB_USER / SUPABASE_DB_PASSWORD
 *   NEXT_SUPABASE_URL （用于推导 storage 前缀）
 *   COS_CDN_VIDEOS / COS_CDN_AVATARS / COS_CDN_CHAT_IMAGES / COS_CDN_ASSETS / COS_CDN_RECEIPTS
 *
 * 用法：
 *   npm run replace:storage-urls                  # dry-run（统计命中）
 *   npm run replace:storage-urls -- --execute     # 真正替换
 */

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development" });
dotenv.config();

const { Client } = pg;

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

type BucketRule = {
  /** Supabase 桶名 */
  srcBucket: string;
  /** CDN 域名 env 名 */
  cdnEnv: string;
  /** 合并桶在 CDN 下的前缀（如 coach-posters/） */
  cdnPrefix: string;
};

const RULES: BucketRule[] = [
  { srcBucket: "videos", cdnEnv: "COS_CDN_VIDEOS", cdnPrefix: "" },
  { srcBucket: "avatars", cdnEnv: "COS_CDN_AVATARS", cdnPrefix: "" },
  { srcBucket: "chat-images", cdnEnv: "COS_CDN_CHAT_IMAGES", cdnPrefix: "" },
  { srcBucket: "coach-posters", cdnEnv: "COS_CDN_ASSETS", cdnPrefix: "coach-posters/" },
  { srcBucket: "knowledge-assets", cdnEnv: "COS_CDN_ASSETS", cdnPrefix: "knowledge-assets/" },
  { srcBucket: "streetlifting-locations", cdnEnv: "COS_CDN_ASSETS", cdnPrefix: "streetlifting-locations/" },
  { srcBucket: "receipts", cdnEnv: "COS_CDN_RECEIPTS", cdnPrefix: "receipts/" },
  { srcBucket: "payment-qrcodes", cdnEnv: "COS_CDN_RECEIPTS", cdnPrefix: "payment-qrcodes/" },
];

type Mapping = { oldPrefix: string; newPrefix: string; srcBucket: string };

function buildMappings(storagePrefix: string): { mappings: Mapping[]; skipped: string[] } {
  const mappings: Mapping[] = [];
  const skipped: string[] = [];
  for (const r of RULES) {
    const cdn = env(r.cdnEnv);
    if (!cdn) {
      skipped.push(r.srcBucket);
      continue;
    }
    mappings.push({
      srcBucket: r.srcBucket,
      oldPrefix: `${storagePrefix}${r.srcBucket}/`,
      newPrefix: `${stripTrailingSlash(cdn)}/${r.cdnPrefix}`,
    });
  }
  return { mappings, skipped };
}

function sqlLiteral(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

/** 把所有 replace() 嵌套到列表达式上 */
function buildReplaceExpr(colExpr: string, mappings: Mapping[]): string {
  let expr = colExpr;
  for (const m of mappings) {
    expr = `replace(${expr}, ${sqlLiteral(m.oldPrefix)}, ${sqlLiteral(m.newPrefix)})`;
  }
  return expr;
}

async function connect(): Promise<pg.Client> {
  const client = new Client({
    host: env("SOURCE_DB_HOST"),
    port: Number(env("SOURCE_DB_PORT") || "5432"),
    database: env("SOURCE_DB_NAME") || "postgres",
    user: env("SOURCE_DB_USER"),
    password: env("SOURCE_DB_PASSWORD") || env("SUPABASE_DB_PASSWORD"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set role service_role");
  return client;
}

type Col = { table: string; column: string; dataType: string };

async function discoverColumns(client: pg.Client): Promise<Col[]> {
  const { rows } = await client.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema = 'public'
        and data_type in ('text','character varying','json','jsonb')
      order by table_name, column_name`,
  );
  return rows.map((r) => ({ table: r.table_name, column: r.column_name, dataType: r.data_type }));
}

function qualifies(dataType: string): "text" | "jsonb" {
  return dataType === "json" || dataType === "jsonb" ? "jsonb" : "text";
}

async function main() {
  const execute = process.argv.includes("--execute");

  const supabaseUrl = stripTrailingSlash(env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL"));
  if (!supabaseUrl) throw new Error("缺少 NEXT_SUPABASE_URL");
  const storagePrefix = `${supabaseUrl}/storage/v1/object/public/`;

  const { mappings, skipped } = buildMappings(storagePrefix);

  console.log("CoachLink 历史 Storage URL → COS CDN 替换");
  console.log(`mode=${execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`storagePrefix=${storagePrefix}`);
  if (skipped.length) console.log(`未配置 CDN，跳过的桶: ${skipped.join(", ")}`);
  if (execute && mappings.length === 0) throw new Error("没有任何可用的 CDN 映射，无法执行");
  console.log("映射:");
  for (const m of mappings) console.log(`  ${m.oldPrefix}  ->  ${m.newPrefix}`);
  console.log("=".repeat(96));

  const client = await connect();
  try {
    const cols = await discoverColumns(client);

    // 命中检测前缀：任意一个 srcBucket 的旧前缀。dry-run 用整体 storagePrefix 计数即可。
    const likeAny = `%${storagePrefix}%`;

    let totalRows = 0;
    const hits: { col: Col; count: number; kind: "text" | "jsonb" }[] = [];

    for (const col of cols) {
      const kind = qualifies(col.dataType);
      const colExpr = kind === "jsonb" ? `"${col.column}"::text` : `"${col.column}"`;
      let count = 0;
      try {
        const { rows } = await client.query<{ c: string }>(
          `select count(*)::int as c from "${col.table}" where ${colExpr} like $1`,
          [likeAny],
        );
        count = rows[0]?.c ? Number(rows[0].c) : 0;
      } catch {
        // 某些系统/视图列不可查，忽略
        continue;
      }
      if (count > 0) {
        hits.push({ col, count, kind });
        totalRows += count;
      }
    }

    if (hits.length === 0) {
      console.log("没有发现包含 Supabase storage 前缀的数据（可能已全部替换）。");
      return;
    }

    for (const h of hits) {
      console.log(`${h.col.table}.${h.col.column} (${h.col.dataType})  命中行 ${h.count}`);
    }
    console.log(`\n命中列 ${hits.length} 个，命中行合计 ${totalRows}`);

    if (!execute) {
      console.log("\n提示: 确认 CDN 映射无误后执行 npm run replace:storage-urls -- --execute");
      return;
    }

    if (mappings.length === 0) throw new Error("没有可用 CDN 映射");

    console.log("\n开始替换 ...");
    let updatedTotal = 0;
    for (const h of hits) {
      const { col, kind } = h;
      const colRef = `"${col.column}"`;
      const inner = kind === "jsonb" ? `${colRef}::text` : colRef;
      const replaced = buildReplaceExpr(inner, mappings);
      const setExpr = kind === "jsonb" ? `(${replaced})::${col.dataType}` : replaced;
      const sql = `update "${col.table}" set ${colRef} = ${setExpr} where ${inner} like $1`;
      const res = await client.query(sql, [likeAny]);
      const n = res.rowCount || 0;
      updatedTotal += n;
      console.log(`  ${col.table}.${col.column}: updated ${n}`);
    }
    console.log(`\n完成。更新行合计 ${updatedTotal}`);
    console.log("核对: 再次运行 npm run replace:storage-urls（应显示 0 命中）");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("替换失败:", e instanceof Error ? e.message : e);
  process.exit(1);
});
