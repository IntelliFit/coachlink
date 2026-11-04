/**
 * 内存版 Supabase（PostgREST）替身，给跨路由的端到端测试用，完全不连数据库。
 *
 * 支持这些模块实际用到的查询形状：select 列表（含 `"quotedColumn"`、`alias:col`、
 * `coaches!inner(user_id)` 这种按配置关系的嵌入）、eq/neq/gt/gte/lt/lte/in/is/not/
 * contains/containedBy/or/like/ilike/match、order（多列、nulls 规则）、limit/range、
 * single/maybeSingle（含多行报错）、insert/update/upsert/delete（可接 select）、
 * count+head、rpc。
 *
 * 语义尽量贴近 Postgres：比较里 NULL 一律不成立（neq 也排除 NULL），
 * ISO 时间字符串按时间比较，返回的行都是拷贝（调用方改了不会写回“数据库”）。
 */
import { randomUUID } from "node:crypto";

export type FakeRow = Record<string, any>;

export type FakeResult = {
    data: any;
    error: { message: string; code?: string; details?: string } | null;
    count?: number | null;
    status?: number;
};

export type FakeRelation = {
    /** 发起嵌入的表 */
    table: string;
    /** select 里写的资源名，如 `coaches` */
    name: string;
    /** 被嵌入的表，默认同 name */
    foreignTable?: string;
    localColumn: string;
    foreignColumn: string;
    /** one：多对一，嵌入对象；many：一对多，嵌入数组 */
    kind: "one" | "many";
};

export type FakeTableConfig = {
    /** 唯一约束，每项是一组列 */
    unique?: string[][];
    /** 插入时的列默认值（数据库 default） */
    defaults?: () => FakeRow;
};

export type FakeQueryLogEntry = {
    table: string;
    op: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
    payload?: unknown;
    filters: string[];
};

export type FakeRpcHandler = (args: any, db: FakeSupabase) => FakeResult | Promise<FakeResult>;

type Filter = (row: FakeRow, embedded: FakeRow) => boolean;
type OrderSpec = { column: string; ascending: boolean; nullsFirst: boolean };

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

function clone<T>(value: T): T {
    return value === undefined ? value : structuredClone(value);
}

function comparable(value: unknown): number | string | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" || typeof value === "boolean") return value;
    const text = String(value);
    if (ISO_DATETIME.test(text)) {
        const ms = Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text);
        if (Number.isFinite(ms)) return ms;
    }
    return text;
}

/** 按 Postgres 口径比较；任一边是 NULL 返回 null（条件不成立）。 */
function compare(left: unknown, right: unknown): number | null {
    const a = comparable(left);
    const b = comparable(right);
    if (a === null || b === null) return null;
    if (typeof a === "number" && typeof b === "string" && b.trim() !== "" && Number.isFinite(Number(b))) {
        return a - Number(b);
    }
    if (typeof a === "string" && typeof b === "number" && a.trim() !== "" && Number.isFinite(Number(a))) {
        return Number(a) - b;
    }
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" || typeof b === "boolean") return String(a) === String(b) ? 0 : 1;
    const sa = String(a);
    const sb = String(b);
    return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function jsonContains(container: unknown, contained: unknown): boolean {
    if (Array.isArray(contained)) {
        if (!Array.isArray(container)) return false;
        return contained.every((item) => container.some((candidate) => jsonContains(candidate, item)));
    }
    if (contained && typeof contained === "object") {
        if (!container || typeof container !== "object" || Array.isArray(container)) return false;
        return Object.entries(contained as FakeRow).every(([key, value]) =>
            jsonContains((container as FakeRow)[key], value));
    }
    return compare(container, contained) === 0;
}

function likeToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
    return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

function parseListLiteral(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const text = String(value ?? "").trim().replace(/^\(/, "").replace(/\)$/, "");
    return text ? text.split(",").map((item) => item.trim().replace(/^"(.*)"$/, "$1")) : [];
}

function literal(value: string): unknown {
    if (value === "null") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
}

/** 列名可以是 `coaches.user_id`，表示嵌入资源上的列。 */
function readColumn(row: FakeRow, embedded: FakeRow, column: string): unknown {
    const clean = column.replace(/"/g, "");
    if (clean.includes(".")) {
        const [alias, ...rest] = clean.split(".");
        const target = embedded[alias];
        const field = rest.join(".");
        if (Array.isArray(target)) return target.map((item) => item?.[field]);
        return target ? target[field] : undefined;
    }
    return row[clean];
}

function buildOperator(op: string, column: string, value: unknown): Filter {
    const read = (row: FakeRow, embedded: FakeRow) => readColumn(row, embedded, column);
    switch (op) {
        case "eq":
            return (row, e) => compare(read(row, e), value) === 0;
        case "neq":
            return (row, e) => {
                const result = compare(read(row, e), value);
                return result !== null && result !== 0;
            };
        case "gt":
            return (row, e) => {
                const result = compare(read(row, e), value);
                return result !== null && result > 0;
            };
        case "gte":
            return (row, e) => {
                const result = compare(read(row, e), value);
                return result !== null && result >= 0;
            };
        case "lt":
            return (row, e) => {
                const result = compare(read(row, e), value);
                return result !== null && result < 0;
            };
        case "lte":
            return (row, e) => {
                const result = compare(read(row, e), value);
                return result !== null && result <= 0;
            };
        case "in": {
            const list = parseListLiteral(value);
            return (row, e) => list.some((item) => compare(read(row, e), item) === 0);
        }
        case "is":
            return (row, e) => {
                const current = read(row, e);
                const expected = typeof value === "string" ? literal(value) : value;
                return expected === null ? current === null || current === undefined : current === expected;
            };
        case "like":
            return (row, e) => likeToRegExp(String(value), false).test(String(read(row, e) ?? ""));
        case "ilike":
            return (row, e) => likeToRegExp(String(value), true).test(String(read(row, e) ?? ""));
        case "cs":
        case "contains":
            return (row, e) => jsonContains(read(row, e), value);
        case "cd":
        case "containedBy":
            return (row, e) => {
                const current = read(row, e);
                if (!Array.isArray(current) || !Array.isArray(value)) return false;
                return current.every((item) => value.some((allowed) => compare(item, allowed) === 0));
            };
        default:
            throw new Error(`fakeSupabase: unsupported operator "${op}" on ${column}`);
    }
}

/** 解析 `.or("a.eq.1,b.is.null")`，只支持一层。 */
function parseOr(expression: string): Filter {
    const parts = expression.split(",").map((part) => part.trim()).filter(Boolean);
    const filters = parts.map((part) => {
        const [column, op, ...rest] = part.split(".");
        const raw = rest.join(".");
        if (op === "not") {
            const [innerOp, ...innerRest] = raw.split(".");
            const inner = buildOperator(innerOp, column, literal(innerRest.join(".")));
            return (row: FakeRow, e: FakeRow) => !inner(row, e);
        }
        const value = op === "in" ? parseListLiteral(raw) : literal(raw);
        return buildOperator(op, column, value);
    });
    return (row, e) => filters.some((filter) => filter(row, e));
}

type SelectNode = { kind: "star" } | { kind: "column"; name: string; alias: string } | {
    kind: "embed";
    alias: string;
    resource: string;
    inner: boolean;
    children: SelectNode[];
};

function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of text) {
        if (char === "(") depth++;
        if (char === ")") depth--;
        if (char === "," && depth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    if (current.trim()) parts.push(current);
    return parts.map((part) => part.trim()).filter(Boolean);
}

function parseSelect(columns: string | undefined): SelectNode[] {
    const text = String(columns ?? "*").replace(/\s+/g, " ").trim() || "*";
    return splitTopLevel(text).map((part): SelectNode => {
        const open = part.indexOf("(");
        if (open >= 0) {
            const head = part.slice(0, open).trim();
            const body = part.slice(open + 1, part.lastIndexOf(")"));
            const [maybeAlias, maybeResource] = head.includes(":") ? head.split(":") : [null, head];
            const [resource, hint] = String(maybeResource).trim().split("!");
            return {
                kind: "embed",
                alias: String(maybeAlias || resource).trim(),
                resource: resource.trim(),
                inner: hint === "inner",
                children: parseSelect(body),
            };
        }
        if (part === "*") return { kind: "star" };
        const [aliasOrName, name] = part.includes(":") ? part.split(":") : [part, part];
        const column = String(name).replace(/"/g, "").replace(/::\w+$/, "").trim();
        return { kind: "column", name: column, alias: String(aliasOrName).replace(/"/g, "").trim() };
    });
}

export class FakeSupabase {
    readonly tables = new Map<string, FakeRow[]>();
    readonly log: FakeQueryLogEntry[] = [];
    readonly relations: FakeRelation[];
    readonly configs: Record<string, FakeTableConfig>;
    private readonly rpcHandlers = new Map<string, FakeRpcHandler>();
    /** 每次查询执行前调用（例如推进假时钟、让出事件循环，模拟网络往返）。 */
    beforeExec: (() => void | Promise<void>) | null = null;
    /** 测试注入故障：返回非 null 时这次查询直接报这个错。 */
    failWhen: ((entry: FakeQueryLogEntry) => FakeResult["error"]) | null = null;

    constructor(options: { relations?: FakeRelation[]; tables?: Record<string, FakeTableConfig> } = {}) {
        this.relations = options.relations || [];
        this.configs = options.tables || {};
    }

    from(table: string) {
        return new FakeQuery(this, table);
    }

    rpc(name: string, args: unknown) {
        return new FakeRpcCall(this, name, args);
    }

    defineRpc(name: string, handler: FakeRpcHandler) {
        this.rpcHandlers.set(name, handler);
    }

    getRpc(name: string) {
        return this.rpcHandlers.get(name);
    }

    table(name: string): FakeRow[] {
        let rows = this.tables.get(name);
        if (!rows) {
            rows = [];
            this.tables.set(name, rows);
        }
        return rows;
    }

    /** 直接写入初始数据（不走约束与日志）。 */
    seed(name: string, rows: FakeRow[]) {
        const table = this.table(name);
        for (const row of rows) table.push(this.withDefaults(name, row));
        return this;
    }

    /** 读出某表的拷贝，给断言用。 */
    rows(name: string, where?: (row: FakeRow) => boolean): FakeRow[] {
        return clone(this.table(name).filter((row) => (where ? where(row) : true)));
    }

    withDefaults(name: string, row: FakeRow): FakeRow {
        const now = new Date().toISOString();
        return {
            id: randomUUID(),
            created_at: now,
            ...(this.configs[name]?.defaults?.() || {}),
            ...clone(row),
        };
    }

    uniqueViolation(name: string, candidate: FakeRow, ignore?: FakeRow): FakeResult["error"] {
        const constraints = [["id"], ...(this.configs[name]?.unique || [])];
        for (const columns of constraints) {
            if (columns.some((column) => candidate[column] === null || candidate[column] === undefined)) continue;
            const clash = this.table(name).find((row) =>
                row !== ignore && columns.every((column) => compare(row[column], candidate[column]) === 0));
            if (clash) {
                return {
                    code: "23505",
                    message: `duplicate key value violates unique constraint "${name}_${columns.join("_")}_key"`,
                };
            }
        }
        return null;
    }

    embed(table: string, row: FakeRow, nodes: SelectNode[]): { embedded: FakeRow; error: FakeResult["error"] } {
        const embedded: FakeRow = {};
        for (const node of nodes) {
            if (node.kind !== "embed") continue;
            const relation = this.relations.find((r) => r.table === table && r.name === node.resource);
            if (!relation) {
                return {
                    embedded,
                    error: {
                        code: "PGRST200",
                        message: `Could not find a relationship between '${table}' and '${node.resource}' in the schema cache`,
                    },
                };
            }
            const foreign = this.table(relation.foreignTable || relation.name);
            const matches = foreign.filter((candidate) =>
                compare(candidate[relation.foreignColumn], row[relation.localColumn]) === 0);
            const projectChild = (child: FakeRow) => {
                const nested = this.embed(relation.foreignTable || relation.name, child, node.children);
                return { ...project(child, node.children), ...nested.embedded };
            };
            embedded[node.alias] = relation.kind === "one"
                ? (matches[0] ? projectChild(matches[0]) : null)
                : matches.map(projectChild);
        }
        return { embedded, error: null };
    }

    async runRpc(name: string, args: unknown): Promise<FakeResult> {
        const handler = this.rpcHandlers.get(name);
        if (!handler) return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } };
        return handler(args, this);
    }
}

function project(row: FakeRow, nodes: SelectNode[]): FakeRow {
    if (nodes.some((node) => node.kind === "star")) {
        const out = clone(row);
        for (const node of nodes) {
            if (node.kind === "column" && node.alias !== node.name) out[node.alias] = clone(row[node.name]);
        }
        return out;
    }
    const out: FakeRow = {};
    for (const node of nodes) {
        if (node.kind === "column") out[node.alias] = clone(row[node.name]);
    }
    return out;
}

type Operation =
    | { kind: "select" }
    | { kind: "insert"; values: FakeRow[] }
    | { kind: "update"; patch: FakeRow }
    | { kind: "upsert"; values: FakeRow[]; onConflict: string[]; ignoreDuplicates: boolean }
    | { kind: "delete" };

export class FakeQuery implements PromiseLike<FakeResult> {
    private operation: Operation = { kind: "select" };
    private selectNodes: SelectNode[] | null = null;
    private returning = false;
    private countMode: string | null = null;
    private head = false;
    private readonly filters: Filter[] = [];
    private readonly filterLabels: string[] = [];
    private readonly orders: OrderSpec[] = [];
    private limitCount: number | null = null;
    private rangeFrom = 0;
    private singleMode: "single" | "maybeSingle" | null = null;

    constructor(private readonly db: FakeSupabase, private readonly tableName: string) {}

    select(columns?: string, options?: { count?: string; head?: boolean }) {
        this.selectNodes = parseSelect(columns);
        if (this.operation.kind !== "select") this.returning = true;
        if (options?.count) this.countMode = options.count;
        if (options?.head) this.head = true;
        return this;
    }

    insert(values: FakeRow | FakeRow[]) {
        this.operation = { kind: "insert", values: Array.isArray(values) ? values : [values] };
        return this;
    }

    update(patch: FakeRow) {
        this.operation = { kind: "update", patch };
        return this;
    }

    upsert(values: FakeRow | FakeRow[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
        this.operation = {
            kind: "upsert",
            values: Array.isArray(values) ? values : [values],
            onConflict: String(options.onConflict || "id").split(",").map((c) => c.trim()).filter(Boolean),
            ignoreDuplicates: options.ignoreDuplicates === true,
        };
        return this;
    }

    delete() {
        this.operation = { kind: "delete" };
        return this;
    }

    private addFilter(label: string, filter: Filter) {
        this.filters.push(filter);
        this.filterLabels.push(label);
        return this;
    }

    eq(column: string, value: unknown) { return this.addFilter(`${column}=eq.${value}`, buildOperator("eq", column, value)); }
    neq(column: string, value: unknown) { return this.addFilter(`${column}=neq.${value}`, buildOperator("neq", column, value)); }
    gt(column: string, value: unknown) { return this.addFilter(`${column}=gt.${value}`, buildOperator("gt", column, value)); }
    gte(column: string, value: unknown) { return this.addFilter(`${column}=gte.${value}`, buildOperator("gte", column, value)); }
    lt(column: string, value: unknown) { return this.addFilter(`${column}=lt.${value}`, buildOperator("lt", column, value)); }
    lte(column: string, value: unknown) { return this.addFilter(`${column}=lte.${value}`, buildOperator("lte", column, value)); }
    in(column: string, values: unknown[]) { return this.addFilter(`${column}=in.(${values})`, buildOperator("in", column, values)); }
    is(column: string, value: unknown) { return this.addFilter(`${column}=is.${value}`, buildOperator("is", column, value)); }
    like(column: string, value: string) { return this.addFilter(`${column}=like.${value}`, buildOperator("like", column, value)); }
    ilike(column: string, value: string) { return this.addFilter(`${column}=ilike.${value}`, buildOperator("ilike", column, value)); }
    contains(column: string, value: unknown) { return this.addFilter(`${column}=cs.${JSON.stringify(value)}`, buildOperator("contains", column, value)); }
    containedBy(column: string, value: unknown) { return this.addFilter(`${column}=cd.${JSON.stringify(value)}`, buildOperator("containedBy", column, value)); }
    or(expression: string) { return this.addFilter(`or=(${expression})`, parseOr(expression)); }

    not(column: string, op: string, value: unknown) {
        const inner = buildOperator(op, column, op === "in" ? parseListLiteral(value) : value);
        return this.addFilter(`${column}=not.${op}.${value}`, (row, e) => !inner(row, e));
    }

    filter(column: string, op: string, value: unknown) {
        if (op.startsWith("not.")) return this.not(column, op.slice(4), value);
        return this.addFilter(`${column}=${op}.${value}`, buildOperator(op, column, op === "in" ? parseListLiteral(value) : literal(String(value))));
    }

    match(values: FakeRow) {
        for (const [column, value] of Object.entries(values)) this.eq(column, value);
        return this;
    }

    order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
        const ascending = options.ascending !== false;
        this.orders.push({ column, ascending, nullsFirst: options.nullsFirst ?? !ascending });
        return this;
    }

    limit(count: number) {
        this.limitCount = count;
        return this;
    }

    range(from: number, to: number) {
        this.rangeFrom = from;
        this.limitCount = to - from + 1;
        return this;
    }

    single() {
        this.singleMode = "single";
        return this;
    }

    maybeSingle() {
        this.singleMode = "maybeSingle";
        return this;
    }

    returns() {
        return this;
    }

    abortSignal() {
        return this;
    }

    then<TResult1 = FakeResult, TResult2 = never>(
        onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.execute().then(onfulfilled, onrejected);
    }

    private matches(row: FakeRow, nodes: SelectNode[]): { keep: boolean; embedded: FakeRow; error: FakeResult["error"] } {
        const { embedded, error } = this.db.embed(this.tableName, row, nodes);
        if (error) return { keep: false, embedded, error };
        for (const node of nodes) {
            if (node.kind === "embed" && node.inner) {
                const value = embedded[node.alias];
                if (value === null || (Array.isArray(value) && value.length === 0)) return { keep: false, embedded, error: null };
            }
        }
        return { keep: this.filters.every((filter) => filter(row, embedded)), embedded, error: null };
    }

    private sortRows(rows: FakeRow[]) {
        if (this.orders.length === 0) return rows;
        return [...rows].sort((left, right) => {
            for (const spec of this.orders) {
                const a = left[spec.column];
                const b = right[spec.column];
                const aNull = a === null || a === undefined;
                const bNull = b === null || b === undefined;
                if (aNull || bNull) {
                    if (aNull && bNull) continue;
                    return (aNull ? -1 : 1) * (spec.nullsFirst ? 1 : -1);
                }
                const result = compare(a, b) ?? 0;
                if (result !== 0) return spec.ascending ? result : -result;
            }
            return 0;
        });
    }

    private finish(rows: FakeRow[], count: number | null): FakeResult {
        if (this.head) return { data: null, error: null, count, status: 200 };
        if (this.operation.kind !== "select" && !this.returning) {
            return { data: null, error: null, count, status: this.operation.kind === "insert" ? 201 : 204 };
        }
        if (this.singleMode) {
            if (rows.length === 1) return { data: rows[0], error: null, count, status: 200 };
            if (rows.length === 0 && this.singleMode === "maybeSingle") return { data: null, error: null, count, status: 200 };
            return {
                data: null,
                error: {
                    code: "PGRST116",
                    message: "JSON object requested, multiple (or no) rows returned",
                    details: `The result contains ${rows.length} rows`,
                },
                count,
                status: 406,
            };
        }
        return { data: rows, error: null, count, status: 200 };
    }

    private async execute(): Promise<FakeResult> {
        const op = this.operation.kind;
        const entry: FakeQueryLogEntry = {
            table: this.tableName,
            op,
            payload: op === "insert" || op === "upsert"
                ? clone((this.operation as { values: FakeRow[] }).values)
                : op === "update" ? clone((this.operation as { patch: FakeRow }).patch) : undefined,
            filters: [...this.filterLabels],
        };
        this.db.log.push(entry);
        if (this.db.beforeExec) await this.db.beforeExec();
        const injected = this.db.failWhen?.(entry);
        if (injected) return { data: null, error: injected, status: 500 };

        const nodes = this.selectNodes || parseSelect("*");
        const table = this.db.table(this.tableName);

        if (this.operation.kind === "insert" || this.operation.kind === "upsert") {
            const operation = this.operation;
            const affected: FakeRow[] = [];
            const pending: Array<{ row: FakeRow; existing?: FakeRow }> = [];
            for (const value of operation.values) {
                const candidate = this.db.withDefaults(this.tableName, value);
                const existing = operation.kind === "upsert"
                    ? table.find((row) => operation.onConflict.every((column) => compare(row[column], candidate[column]) === 0))
                    : undefined;
                if (existing) {
                    if (operation.kind === "upsert" && operation.ignoreDuplicates) continue;
                    pending.push({ row: { ...existing, ...clone(value) }, existing });
                    continue;
                }
                const violation = this.db.uniqueViolation(this.tableName, candidate);
                if (violation) return { data: null, error: violation, status: 409 };
                pending.push({ row: candidate });
            }
            for (const item of pending) {
                if (item.existing) {
                    Object.assign(item.existing, item.row);
                    affected.push(item.existing);
                } else {
                    table.push(item.row);
                    affected.push(item.row);
                }
            }
            return this.finish(affected.map((row) => ({ ...project(row, nodes), ...this.db.embed(this.tableName, row, nodes).embedded })), null);
        }

        const matched: Array<{ row: FakeRow; embedded: FakeRow }> = [];
        for (const row of table) {
            const result = this.matches(row, nodes);
            if (result.error) return { data: null, error: result.error, status: 400 };
            if (result.keep) matched.push({ row, embedded: result.embedded });
        }

        if (this.operation.kind === "update") {
            const patch = this.operation.patch;
            for (const { row } of matched) {
                const violation = this.db.uniqueViolation(this.tableName, { ...row, ...patch }, row);
                if (violation) return { data: null, error: violation, status: 409 };
            }
            for (const { row } of matched) Object.assign(row, clone(patch));
            return this.finish(matched.map(({ row }) => ({ ...project(row, nodes), ...this.db.embed(this.tableName, row, nodes).embedded })), null);
        }

        if (this.operation.kind === "delete") {
            const doomed = new Set(matched.map(({ row }) => row));
            const remaining = table.filter((row) => !doomed.has(row));
            table.length = 0;
            table.push(...remaining);
            return this.finish(matched.map(({ row }) => project(row, nodes)), null);
        }

        const sorted = this.sortRows(matched.map(({ row }) => row));
        const embeddedByRow = new Map(matched.map(({ row, embedded }) => [row, embedded]));
        const count = this.countMode ? sorted.length : null;
        const sliced = sorted.slice(this.rangeFrom, this.limitCount === null ? undefined : this.rangeFrom + this.limitCount);
        return this.finish(sliced.map((row) => ({ ...project(row, nodes), ...clone(embeddedByRow.get(row) || {}) })), count);
    }
}

class FakeRpcCall implements PromiseLike<FakeResult> {
    private singleMode = false;

    constructor(private readonly db: FakeSupabase, private readonly name: string, private readonly args: unknown) {}

    single() {
        this.singleMode = true;
        return this;
    }

    then<TResult1 = FakeResult, TResult2 = never>(
        onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.execute().then(onfulfilled, onrejected);
    }

    private async execute(): Promise<FakeResult> {
        this.db.log.push({ table: this.name, op: "rpc", payload: clone(this.args), filters: [] });
        if (this.db.beforeExec) await this.db.beforeExec();
        const result = await this.db.runRpc(this.name, this.args);
        if (this.singleMode && Array.isArray(result.data)) return { ...result, data: result.data[0] ?? null };
        return { ...result, data: clone(result.data) };
    }
}
