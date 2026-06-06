/**
 * Supabase (PostgreSQL) → 自建 PostgreSQL 迁移工具
 *
 * 特性：
 * - 默认 dry-run（只报告计划，不写库）；加 --execute 才真正迁移
 * - 跳过已有数据：每次运行实时查库（不用本地状态文件）
 *   - schema：目标库已存在的表/视图/函数/扩展 → SKIP
 *   - data：按主键检测缺失行，缺失为 0 → SKIP；否则只 INSERT 缺失行（ON CONFLICT DO NOTHING）
 *
 * 环境变量（二选一写法）：
 *   SOURCE_DATABASE_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
 *   TARGET_DATABASE_URL=postgresql://app_user:...@154.8.205.78:5432/coachlink?sslmode=disable
 *
 *   或离散字段：
 *   SOURCE_DB_HOST / SOURCE_DB_PORT / SOURCE_DB_NAME / SOURCE_DB_USER / SOURCE_DB_PASSWORD / SOURCE_DB_SSLMODE
 *   TARGET_DB_HOST / TARGET_DB_PORT / TARGET_DB_NAME / TARGET_DB_USER / TARGET_DB_PASSWORD / TARGET_DB_SSLMODE
 *
 * 注意：
 * - SOURCE 必须是 Supabase「Database → Connection string → URI」（直连 Postgres），不是 REST URL / anon key
 * - Storage 桶里的文件不在 PG 里，本脚本只迁 storage.buckets / storage.objects 元数据
 * - 建议 TARGET 用 superuser 或具备 session_replication_role 的账号，以便忽略 FK 顺序批量导入
 *
 * 用法：
 *   npx tsx scripts/migrate-supabase-to-postgres.ts
 *   npx tsx scripts/migrate-supabase-to-postgres.ts --execute
 *   npx tsx scripts/migrate-supabase-to-postgres.ts --execute --phase=data
 *   npx tsx scripts/migrate-supabase-to-postgres.ts --schemas=public,auth,storage --json
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development" });
dotenv.config({ path: ".env.production" });
dotenv.config();

const { Client } = pg;

type Phase = "all" | "schema" | "data";
type TableKind = "BASE TABLE" | "VIEW";

type CliOptions = {
  execute: boolean;
  phase: Phase;
  schemas: string[];
  batchSize: number;
  json: boolean;
  tables?: Set<string>;
};

type TableMeta = {
  schema: string;
  name: string;
  kind: TableKind;
  qualifiedName: string;
};

type MigrationPlanRow = {
  schema: string;
  object: string;
  kind: string;
  sourceRows: number | null;
  targetRows: number | null;
  missingRows: number | null;
  action: "SKIP" | "MIGRATE" | "CREATE_SCHEMA" | "WARN";
  detail?: string;
};

type SourceBackend =
  | { mode: "pg"; client: pg.Client }
  | { mode: "api"; supabase: SupabaseClient; publicTables: Set<string> };

function parseArgs(argv: string[]): CliOptions {
  const execute = argv.includes("--execute");
  const json = argv.includes("--json");
  const phaseArg = argv.find((a) => a.startsWith("--phase="));
  const phase = (phaseArg?.split("=")[1] || "all") as Phase;
  if (!["all", "schema", "data"].includes(phase)) {
    throw new Error("Unsupported --phase. Use all | schema | data.");
  }

  const schemasArg = argv.find((a) => a.startsWith("--schemas="));
  const schemas = (schemasArg?.split("=")[1] || "public,auth,storage")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const batchArg = argv.find((a) => a.startsWith("--batch-size="));
  const batchSize = Math.max(100, Number(batchArg?.split("=")[1] || 500));

  const tablesArg = argv.find((a) => a.startsWith("--tables="));
  const tables = tablesArg
    ? new Set(
        tablesArg
          .split("=")[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : undefined;

  return { execute, phase, schemas, batchSize, json, tables };
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function deriveSupabaseProjectRef(): string | null {
  const url = env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || "";
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function getSourcePassword(): string | undefined {
  return env("SOURCE_DB_PASSWORD") || env("SUPABASE_DB_PASSWORD");
}

function hasSupabaseApiCredentials(): boolean {
  const url = env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    env("NEXT_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(url && key);
}

function createSupabaseAdmin(): SupabaseClient {
  const url = env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    env("NEXT_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing NEXT_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY for API mode.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listPublicTablesViaOpenApi(
  supabaseUrl: string,
  serviceKey: string,
): Promise<Set<string>> {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/openapi+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Supabase OpenAPI (${res.status}): ${await res.text()}`);
  }
  const doc = (await res.json()) as { paths?: Record<string, unknown> };
  const tables = new Set<string>();
  for (const path of Object.keys(doc.paths || {})) {
    const match = path.match(/^\/([^/?]+)$/);
    if (match?.[1]) tables.add(match[1]);
  }
  return tables;
}

function tryBuildSourceDatabaseUrl(): string | null {
  const password = getSourcePassword();
  if (!password) return null;
  return buildDatabaseUrl("SOURCE", password);
}

function buildDatabaseUrl(prefix: "SOURCE" | "TARGET", sourcePassword?: string): string {
  const direct = env(`${prefix}_DATABASE_URL`);
  if (direct) return direct;

  const ref = prefix === "SOURCE" ? deriveSupabaseProjectRef() : null;
  const host =
    env(`${prefix}_DB_HOST`) ||
    (ref ? `db.${ref}.supabase.co` : undefined);
  const port = env(`${prefix}_DB_PORT`) || "5432";
  const name =
    env(`${prefix}_DB_NAME`) ||
    (prefix === "SOURCE" ? "postgres" : undefined);
  const user =
    env(`${prefix}_DB_USER`) ||
    (prefix === "SOURCE" ? "postgres" : undefined);
  const password =
    env(`${prefix}_DB_PASSWORD`) ||
    (prefix === "SOURCE" ? sourcePassword || getSourcePassword() : undefined) ||
    "";
  const sslmode =
    env(`${prefix}_DB_SSLMODE`) ||
    (prefix === "SOURCE" ? "require" : "prefer");

  if (!host || !user || !name) {
    throw new Error(
      `Missing ${prefix} connection config. Set ${prefix}_DATABASE_URL or ${prefix}_DB_HOST + ${prefix}_DB_USER (+ password).` +
        (prefix === "SOURCE"
          ? " For Supabase, also set SUPABASE_DB_PASSWORD (Dashboard → Database password, not anon/service key)."
          : ""),
    );
  }

  if (prefix === "SOURCE" && !password) {
    throw new Error(
      "Missing Supabase database password. Set SUPABASE_DB_PASSWORD or SOURCE_DB_PASSWORD " +
        "(Supabase Dashboard → Project Settings → Database → Database password).",
    );
  }

  return buildPgUrl(host, port, name, user, password, sslmode);
}

function buildPgUrl(
  host: string,
  port: string,
  name: string,
  user: string,
  password: string,
  sslmode: string,
): string {
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);
  const auth = password ? `${encodedUser}:${encodedPass}` : encodedUser;
  return `postgresql://${auth}@${host}:${port}/${name}?sslmode=${sslmode}`;
}

async function resolveSourceBackend(options: CliOptions): Promise<SourceBackend> {
  const sourceUrl = tryBuildSourceDatabaseUrl();
  if (sourceUrl) {
    const client = await connectClient("SOURCE (pg)", sourceUrl);
    return { mode: "pg", client };
  }

  if (options.execute) {
    throw new Error(
      "执行迁移必须配置 Supabase 直连密码 SUPABASE_DB_PASSWORD（Dashboard → Database password）。",
    );
  }

  if (!hasSupabaseApiCredentials()) {
    throw new Error(
      "缺少 SOURCE 配置：请设置 SUPABASE_DB_PASSWORD，或至少提供 NEXT_SUPABASE_URL + NEXT_SUPABASE_SERVICE_ROLE_KEY 以便 dry-run。",
    );
  }

  console.warn(
    "⚠ 未配置 SUPABASE_DB_PASSWORD：dry-run 改用 Supabase REST API 统计 public 表；auth/storage 与 schema 阶段需补密码后重跑。",
  );
  const supabase = createSupabaseAdmin();
  const supabaseUrl = env("NEXT_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || "";
  const serviceKey =
    env("NEXT_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicTables = await listPublicTablesViaOpenApi(supabaseUrl, serviceKey);
  console.log(`✓ SOURCE (api): public 表 ${publicTables.size} 张（OpenAPI 探测）`);
  return { mode: "api", supabase, publicTables };
}

async function closeSourceBackend(source: SourceBackend): Promise<void> {
  if (source.mode === "pg") await source.client.end();
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function qualified(schema: string, name: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

async function connectClient(label: string, connectionString: string): Promise<pg.Client> {
  const client = new Client({
    connectionString,
    statement_timeout: 0,
    query_timeout: 0,
    connectionTimeoutMillis: 30_000,
  });
  await client.connect();
  const { rows } = await client.query("select current_database() as db, current_user as usr");
  console.log(`✓ ${label}: db=${rows[0].db}, user=${rows[0].usr}`);
  return client;
}

async function listExtensions(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ extname: string }>(
    `select extname from pg_extension order by extname`,
  );
  return rows.map((r) => r.extname);
}

async function listRelations(client: pg.Client, schemas: string[], kind?: TableKind): Promise<TableMeta[]> {
  const { rows } = await client.query<{ table_schema: string; table_name: string; table_type: string }>(
    `
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema = any($1::text[])
        ${kind ? "and table_type = $2" : ""}
      order by table_schema, table_name
    `,
    kind ? [schemas, kind] : [schemas],
  );

  return rows.map((r) => ({
    schema: r.table_schema,
    name: r.table_name,
    kind: r.table_type as TableKind,
    qualifiedName: qualified(r.table_schema, r.table_name),
  }));
}

async function countRowsFromSource(source: SourceBackend, meta: TableMeta): Promise<number> {
  if (source.mode === "pg") return countRows(source.client, meta);
  if (meta.schema !== "public" || meta.kind !== "BASE TABLE") {
    throw new Error(`API 模式无法统计 ${meta.schema}.${meta.name}`);
  }
  if (!source.publicTables.has(meta.name)) return 0;
  const { count, error } = await source.supabase
    .from(meta.name)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${meta.name}: ${error.message}`);
  return count ?? 0;
}

async function listSourceRelations(
  source: SourceBackend,
  schemas: string[],
  kind?: TableKind,
): Promise<TableMeta[]> {
  if (source.mode === "pg") {
    return listRelations(source.client, schemas, kind);
  }
  if (kind === "VIEW" || !schemas.includes("public")) return [];
  return [...source.publicTables]
    .sort()
    .map((name) => ({
      schema: "public",
      name,
      kind: "BASE TABLE" as TableKind,
      qualifiedName: qualified("public", name),
    }));
}

async function resolvePrimaryKeyColumns(
  source: SourceBackend,
  target: pg.Client,
  meta: TableMeta,
): Promise<string[]> {
  if (source.mode === "pg") {
    return getPrimaryKeyColumns(source.client, meta.schema, meta.name);
  }
  try {
    const pk = await getPrimaryKeyColumns(target, meta.schema, meta.name);
    if (pk.length > 0) return pk;
  } catch {
    // target 表可能尚不存在
  }
  return ["id"];
}

async function fetchSourcePkRowsApi(
  supabase: SupabaseClient,
  table: string,
  pkCols: string[],
): Promise<Record<string, unknown>[]> {
  const selectCols = pkCols.join(",");
  const pageSize = 1000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function countMissingRowsByPkFromSource(
  source: SourceBackend,
  target: pg.Client,
  meta: TableMeta,
  pkCols: string[],
): Promise<number> {
  const pkSelect = pkCols.map((c) => quoteIdent(c)).join(", ");
  const targetRes = await target.query(`select ${pkSelect} from ${meta.qualifiedName}`);
  const existing = new Set(targetRes.rows.map((r) => pkKey(r, pkCols)));

  if (source.mode === "pg") {
    if (existing.size === 0) return countRows(source.client, meta);
    const sourceRes = await source.client.query(`select ${pkSelect} from ${meta.qualifiedName}`);
    let missing = 0;
    for (const row of sourceRes.rows) {
      if (!existing.has(pkKey(row, pkCols))) missing += 1;
    }
    return missing;
  }

  const sourceRows = await fetchSourcePkRowsApi(source.supabase, meta.name, pkCols);
  if (existing.size === 0) return sourceRows.length;
  let missing = 0;
  for (const row of sourceRows) {
    if (!existing.has(pkKey(row, pkCols))) missing += 1;
  }
  return missing;
}

async function countMissingRowsWithoutPkFromSource(
  source: SourceBackend,
  target: pg.Client,
  meta: TableMeta,
): Promise<number> {
  const sourceCount = await countRowsFromSource(source, meta);
  const targetCount = await countRows(target, meta);
  if (targetCount >= sourceCount) return 0;
  return sourceCount - targetCount;
}

async function countRows(client: pg.Client, meta: TableMeta): Promise<number> {
  if (meta.kind !== "BASE TABLE") return 0;
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::bigint as count from ${meta.qualifiedName}`,
  );
  return Number(rows[0].count);
}

async function getPrimaryKeyColumns(client: pg.Client, schema: string, table: string): Promise<string[]> {
  const { rows } = await client.query<{ column_name: string }>(
    `
      select kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_schema = kcu.constraint_schema
       and tc.constraint_name = kcu.constraint_name
      where tc.table_schema = $1
        and tc.table_name = $2
        and tc.constraint_type = 'PRIMARY KEY'
      order by kcu.ordinal_position
    `,
    [schema, table],
  );
  return rows.map((r) => r.column_name);
}

async function getColumnNames(client: pg.Client, schema: string, table: string): Promise<string[]> {
  const { rows } = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position
    `,
    [schema, table],
  );
  return rows.map((r) => r.column_name);
}

function pkKey(row: Record<string, unknown>, pkCols: string[]): string {
  return pkCols.map((c) => JSON.stringify(row[c] ?? null)).join("\u0001");
}

function findPgDumpBinary(): string | null {
  const candidates = [
    env("PG_DUMP_PATH"),
    "pg_dump",
    "pg_dump.exe",
    path.join("C:", "Program Files", "PostgreSQL", "16", "bin", "pg_dump.exe"),
    path.join("C:", "Program Files", "PostgreSQL", "15", "bin", "pg_dump.exe"),
  ].filter(Boolean) as string[];

  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return bin;
  }
  return null;
}

function findPsqlBinary(): string | null {
  const candidates = [
    env("PSQL_PATH"),
    "psql",
    "psql.exe",
    path.join("C:", "Program Files", "PostgreSQL", "16", "bin", "psql.exe"),
    path.join("C:", "Program Files", "PostgreSQL", "15", "bin", "psql.exe"),
  ].filter(Boolean) as string[];

  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return bin;
  }
  return null;
}

async function migrateSchemaWithPgDump(
  sourceUrl: string,
  targetUrl: string,
  schemas: string[],
  execute: boolean,
  plan: MigrationPlanRow[],
): Promise<void> {
  const pgDump = findPgDumpBinary();
  const psql = findPsqlBinary();

  if (!pgDump || !psql) {
    plan.push({
      schema: "*",
      object: "schema_dump",
      kind: "tooling",
      sourceRows: null,
      targetRows: null,
      missingRows: null,
      action: "WARN",
      detail:
        "未找到 pg_dump/psql。请安装 PostgreSQL 客户端，或设置 PG_DUMP_PATH / PSQL_PATH；也可先在目标库按序执行 supabase/migrations/*.sql",
    });
    return;
  }

  const args = [
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-subscriptions",
    "--format=plain",
    ...schemas.flatMap((s) => ["-n", s]),
    sourceUrl,
  ];

  if (!execute) {
    plan.push({
      schema: "*",
      object: "pg_dump_schema",
      kind: "schema",
      sourceRows: null,
      targetRows: null,
      missingRows: null,
      action: "CREATE_SCHEMA",
      detail: `将执行: ${pgDump} ${args.map((a) => (a.includes("://") ? "<SOURCE_DATABASE_URL>" : a)).join(" ")} | ${psql} <TARGET>`,
    });
    return;
  }

  const dump = spawnSync(pgDump, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 256 });
  if (dump.status !== 0) {
    throw new Error(`pg_dump failed: ${dump.stderr || dump.stdout}`);
  }

  const tmpFile = path.join(os.tmpdir(), `coachlink-schema-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, dump.stdout, "utf8");

  const restore = spawnSync(psql, [targetUrl, "-v", "ON_ERROR_STOP=0", "-f", tmpFile], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  fs.unlinkSync(tmpFile);

  plan.push({
    schema: "*",
    object: "pg_dump_schema",
    kind: "schema",
    sourceRows: null,
    targetRows: null,
    missingRows: null,
    action: restore.status === 0 ? "MIGRATE" : "WARN",
    detail:
      restore.status === 0
        ? "schema dump 已应用到目标库（已存在对象报错会被忽略）"
        : `psql 退出码 ${restore.status}，请检查 stderr: ${(restore.stderr || "").slice(0, 500)}`,
  });
}

async function ensureExtensions(
  source: SourceBackend,
  target: pg.Client,
  execute: boolean,
  plan: MigrationPlanRow[],
): Promise<void> {
  if (source.mode === "api") {
    plan.push({
      schema: "*",
      object: "extensions",
      kind: "schema",
      sourceRows: null,
      targetRows: null,
      missingRows: null,
      action: "WARN",
      detail: "API 模式无法对比扩展；执行 schema 迁移前请配置 SUPABASE_DB_PASSWORD",
    });
    return;
  }

  const sourceExt = await listExtensions(source.client);
  const targetExt = new Set(await listExtensions(target));

  for (const ext of sourceExt) {
    if (targetExt.has(ext)) {
      plan.push({
        schema: "pg_catalog",
        object: ext,
        kind: "extension",
        sourceRows: null,
        targetRows: null,
        missingRows: null,
        action: "SKIP",
        detail: "目标库已安装",
      });
      continue;
    }

    plan.push({
      schema: "pg_catalog",
      object: ext,
      kind: "extension",
      sourceRows: null,
      targetRows: null,
      missingRows: null,
      action: "CREATE_SCHEMA",
      detail: `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(ext)}`,
    });

    if (execute) {
      await target.query(`create extension if not exists ${quoteIdent(ext)}`);
    }
  }
}

async function planMissingTables(
  source: SourceBackend,
  target: pg.Client,
  schemas: string[],
  plan: MigrationPlanRow[],
): Promise<void> {
  const sourceTables = await listSourceRelations(source, schemas, "BASE TABLE");
  const targetNames = new Set(
    (await listRelations(target, schemas, "BASE TABLE")).map((t) => `${t.schema}.${t.name}`),
  );

  for (const table of sourceTables) {
    const key = `${table.schema}.${table.name}`;
    if (targetNames.has(key)) continue;
    plan.push({
      schema: table.schema,
      object: table.name,
      kind: "table",
      sourceRows: null,
      targetRows: 0,
      missingRows: null,
      action: "CREATE_SCHEMA",
      detail: "目标库缺少该表，需先跑 schema 阶段",
    });
  }
}

async function planAndMigrateData(
  source: SourceBackend,
  target: pg.Client,
  options: CliOptions,
  plan: MigrationPlanRow[],
): Promise<void> {
  if (options.execute && source.mode === "api") {
    throw new Error("数据迁移不能使用 API 模式，请配置 SUPABASE_DB_PASSWORD 后重试。");
  }

  let tables = (await listSourceRelations(source, options.schemas, "BASE TABLE")).filter(
    (t) => !options.tables || options.tables.has(t.name),
  );

  if (source.mode === "pg") {
    tables = await sortTablesByDependencies(source.client, tables);
  }

  for (const table of tables) {
    let sourceRows = 0;
    try {
      sourceRows = await countRowsFromSource(source, table);
    } catch (error) {
      plan.push({
        schema: table.schema,
        object: table.name,
        kind: "data",
        sourceRows: null,
        targetRows: null,
        missingRows: null,
        action: "WARN",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    let targetRows = 0;
    let tableExists = true;
    try {
      targetRows = await countRows(target, table);
    } catch {
      tableExists = false;
    }

    if (!tableExists) {
      plan.push({
        schema: table.schema,
        object: table.name,
        kind: "data",
        sourceRows,
        targetRows: 0,
        missingRows: sourceRows,
        action: "WARN",
        detail: "目标表不存在，跳过数据；请先 --phase=schema",
      });
      continue;
    }

    if (sourceRows === 0) {
      plan.push({
        schema: table.schema,
        object: table.name,
        kind: "data",
        sourceRows,
        targetRows,
        missingRows: 0,
        action: "SKIP",
        detail: "源表为空",
      });
      continue;
    }

    const pkCols = await resolvePrimaryKeyColumns(source, target, table);
    let columns: string[] = [];
    if (source.mode === "pg") {
      columns = await getColumnNames(source.client, table.schema, table.name);
    } else {
      try {
        columns = await getColumnNames(target, table.schema, table.name);
      } catch {
        columns = pkCols;
      }
    }

    let missingRows: number;
    if (pkCols.length > 0) {
      missingRows = await countMissingRowsByPkFromSource(source, target, table, pkCols);
    } else {
      missingRows = await countMissingRowsWithoutPkFromSource(source, target, table);
    }

    if (missingRows === 0) {
      plan.push({
        schema: table.schema,
        object: table.name,
        kind: "data",
        sourceRows,
        targetRows,
        missingRows: 0,
        action: "SKIP",
        detail: pkCols.length > 0 ? `按主键(${pkCols.join(", ")})检测无缺失` : "行数已对齐（无 PK，弱检测）",
      });
      continue;
    }

    plan.push({
      schema: table.schema,
      object: table.name,
      kind: "data",
      sourceRows,
      targetRows,
      missingRows,
      action: "MIGRATE",
      detail:
        pkCols.length > 0
          ? `将插入 ${missingRows} 行（PK: ${pkCols.join(", ")}）`
          : `将尝试补齐约 ${missingRows} 行（无 PK，按行数差）`,
    });

    if (options.execute && source.mode === "pg") {
      await copyMissingRows(source.client, target, table, columns, pkCols, options.batchSize);
      await syncSequence(target, table, columns);
    }
  }
}

async function sortTablesByDependencies(client: pg.Client, tables: TableMeta[]): Promise<TableMeta[]> {
  const tableSet = new Set(tables.map((t) => `${t.schema}.${t.name}`));
  const { rows } = await client.query<{
    src_schema: string;
    src_table: string;
    ref_schema: string;
    ref_table: string;
  }>(
    `
      select
        tc.table_schema as src_schema,
        tc.table_name as src_table,
        ccu.table_schema as ref_schema,
        ccu.table_name as ref_table
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.constraint_schema = tc.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY'
    `,
  );

  const deps = new Map<string, Set<string>>();
  for (const t of tables) deps.set(`${t.schema}.${t.name}`, new Set());
  for (const r of rows) {
    const src = `${r.src_schema}.${r.src_table}`;
    const ref = `${r.ref_schema}.${r.ref_table}`;
    if (tableSet.has(src) && tableSet.has(ref) && src !== ref) {
      deps.get(src)?.add(ref);
    }
  }

  const sorted: TableMeta[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byKey = new Map(tables.map((t) => [`${t.schema}.${t.name}`, t] as const));

  function visit(key: string) {
    if (visited.has(key)) return;
    if (visiting.has(key)) return;
    visiting.add(key);
    for (const dep of deps.get(key) || []) visit(dep);
    visiting.delete(key);
    visited.add(key);
    const meta = byKey.get(key);
    if (meta) sorted.push(meta);
  }

  for (const t of tables) visit(`${t.schema}.${t.name}`);
  return sorted;
}

async function copyMissingRows(
  source: pg.Client,
  target: pg.Client,
  table: TableMeta,
  columns: string[],
  pkCols: string[],
  batchSize: number,
): Promise<void> {
  const colList = columns.map(quoteIdent).join(", ");
  const targetPkSet = new Set<string>();

  if (pkCols.length > 0) {
    const pkSelect = pkCols.map((c) => quoteIdent(c)).join(", ");
    const existing = await target.query(`select ${pkSelect} from ${table.qualifiedName}`);
    for (const row of existing.rows) targetPkSet.add(pkKey(row, pkCols));
  }

  const orderCol = pkCols[0] ? quoteIdent(pkCols[0]) : quoteIdent(columns[0]);

  let offset = 0;
  for (;;) {
    const batch = await source.query(
      `select ${colList} from ${table.qualifiedName} order by ${orderCol} limit $1 offset $2`,
      [batchSize, offset],
    );
    if (batch.rows.length === 0) break;

    const rowsToInsert = pkCols.length
      ? batch.rows.filter((row) => !targetPkSet.has(pkKey(row, pkCols)))
      : batch.rows;

    if (rowsToInsert.length > 0) {
      await insertBatch(target, table, columns, pkCols, rowsToInsert);
      for (const row of rowsToInsert) {
        if (pkCols.length) targetPkSet.add(pkKey(row, pkCols));
      }
    }

    offset += batch.rows.length;
    if (batch.rows.length < batchSize) break;
  }
}

async function insertBatch(
  target: pg.Client,
  table: TableMeta,
  columns: string[],
  pkCols: string[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const colList = columns.map(quoteIdent).join(", ");
  const values: unknown[] = [];
  const tuples: string[] = [];

  rows.forEach((row, rowIndex) => {
    const placeholders = columns.map((_, colIndex) => {
      values.push(row[columns[colIndex]]);
      return `$${rowIndex * columns.length + colIndex + 1}`;
    });
    tuples.push(`(${placeholders.join(", ")})`);
  });

  const conflict =
    pkCols.length > 0
      ? ` on conflict (${pkCols.map(quoteIdent).join(", ")}) do nothing`
      : "";

  await target.query(
    `insert into ${table.qualifiedName} (${colList}) values ${tuples.join(", ")}${conflict}`,
    values,
  );
}

async function syncSequence(target: pg.Client, table: TableMeta, columns: string[]): Promise<void> {
  for (const column of columns) {
    const seqResult = await target.query<{ seq: string | null }>(
      `select pg_get_serial_sequence($1, $2) as seq`,
      [`${table.schema}.${table.name}`, column],
    );
    const seq = seqResult.rows[0]?.seq;
    if (!seq) continue;

    const maxResult = await target.query<{ max: string | null }>(
      `select max(${quoteIdent(column)})::text as max from ${table.qualifiedName}`,
    );
    const maxVal = maxResult.rows[0]?.max;
    if (maxVal !== null && maxVal !== undefined) {
      await target.query(`select setval($1::regclass, $2::bigint, true)`, [seq, maxVal]);
    }
  }
}

function printPlan(options: CliOptions, plan: MigrationPlanRow[]): void {
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          mode: options.execute ? "execute" : "dry-run",
          phase: options.phase,
          schemas: options.schemas,
          rows: plan,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("\n" + "=".repeat(100));
  console.log(options.execute ? "EXECUTE 模式：以下变更已执行或 attempted" : "DRY-RUN 模式：仅展示计划（加 --execute 才会写入）");
  console.log("=".repeat(100));

  const header = [
    "Schema".padEnd(10),
    "Object".padEnd(32),
    "Kind".padEnd(10),
    "Source".padStart(8),
    "Target".padStart(8),
    "Missing".padStart(8),
    "Action".padEnd(14),
    "Detail",
  ].join(" ");
  console.log(header);
  console.log("-".repeat(100));

  for (const row of plan) {
    const line = [
      row.schema.padEnd(10),
      row.object.slice(0, 32).padEnd(32),
      row.kind.padEnd(10),
      formatNum(row.sourceRows).padStart(8),
      formatNum(row.targetRows).padStart(8),
      formatNum(row.missingRows).padStart(8),
      row.action.padEnd(14),
      row.detail || "",
    ].join(" ");
    console.log(line);
  }

  const migrateData = plan.filter((r) => r.action === "MIGRATE" && r.kind === "data").length;
  const skipData = plan.filter((r) => r.action === "SKIP" && r.kind === "data").length;
  const missingTotal = plan
    .filter((r) => r.kind === "data" && typeof r.missingRows === "number")
    .reduce((sum, r) => sum + (r.missingRows || 0), 0);

  console.log("-".repeat(100));
  console.log(
    `汇总: 数据表 MIGRATE=${migrateData}, SKIP=${skipData}, 预计新增行≈${missingTotal}, WARN/CREATE_SCHEMA 请单独看 Detail`,
  );
}

function formatNum(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

async function withReplicationRole<T>(target: pg.Client, fn: () => Promise<T>): Promise<T> {
  let disabled = false;
  try {
    await target.query("set session_replication_role = replica");
    disabled = true;
  } catch {
    console.warn("⚠ 无法在目标库设置 session_replication_role=replica，将按 FK 顺序导入");
  }

  try {
    return await fn();
  } finally {
    if (disabled) {
      await target.query("set session_replication_role = default");
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetUrl = buildDatabaseUrl("TARGET");
  const sourceUrl = tryBuildSourceDatabaseUrl();

  console.log("CoachLink Supabase → PostgreSQL 迁移");
  console.log(`phase=${options.phase}, schemas=${options.schemas.join(",")}, batchSize=${options.batchSize}`);
  console.log(`mode=${options.execute ? "EXECUTE" : "DRY-RUN"}`);

  const source = await resolveSourceBackend(options);
  const target = await connectClient("TARGET", targetUrl);

  const plan: MigrationPlanRow[] = [];

  try {
    if (options.phase === "all" || options.phase === "schema") {
      await ensureExtensions(source, target, options.execute, plan);
      await planMissingTables(source, target, options.schemas, plan);
      if (sourceUrl) {
        await migrateSchemaWithPgDump(sourceUrl, targetUrl, options.schemas, options.execute, plan);
      } else {
        plan.push({
          schema: "*",
          object: "pg_dump_schema",
          kind: "schema",
          sourceRows: null,
          targetRows: null,
          missingRows: null,
          action: "WARN",
          detail: "未配置 SUPABASE_DB_PASSWORD，无法 dry-run/execute schema dump；请补密码或手动跑 supabase/migrations",
        });
      }
    }

    if (options.phase === "all" || options.phase === "data") {
      await withReplicationRole(target, async () => {
        await planAndMigrateData(source, target, options, plan);
      });
    }
  } finally {
    await closeSourceBackend(source);
    await target.end();
  }

  printPlan(options, plan);

  if (!options.execute) {
    console.log("\n提示: 确认无误后执行: npm run migrate:supabase-to-pg -- --execute");
  }
}

main().catch((error) => {
  console.error("迁移失败:", error instanceof Error ? error.message : error);
  process.exit(1);
});
