type ExecResult = { data?: any; error?: any; count?: number | null };

export type SupabaseExecContext = {
  table: string;
  op: "select" | "update" | "insert" | "delete";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: Array<{ kind: string; args: any[] }>;
};

export type SupabaseExecHandler = (ctx: SupabaseExecContext) => Promise<ExecResult> | ExecResult;

class MockQuery implements PromiseLike<ExecResult> {
  private table: string;
  private op: SupabaseExecContext["op"] = "select";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private payload: any = undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filters: Array<{ kind: string; args: any[] }> = [];
  private execHandler: SupabaseExecHandler;

  constructor(table: string, execHandler: SupabaseExecHandler) {
    this.table = table;
    this.execHandler = execHandler;
  }

  select(...args: any[]) {
    this.op = "select";
    this.filters.push({ kind: "select", args });
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    this.filters.push({ kind: "update", args: [payload] });
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    this.filters.push({ kind: "insert", args: [payload] });
    return this;
  }
  delete() {
    this.op = "delete";
    this.filters.push({ kind: "delete", args: [] });
    return this;
  }

  eq(...args: any[]) { this.filters.push({ kind: "eq", args }); return this; }
  not(...args: any[]) { this.filters.push({ kind: "not", args }); return this; }
  gt(...args: any[]) { this.filters.push({ kind: "gt", args }); return this; }
  lt(...args: any[]) { this.filters.push({ kind: "lt", args }); return this; }
  in(...args: any[]) { this.filters.push({ kind: "in", args }); return this; }
  order(...args: any[]) { this.filters.push({ kind: "order", args }); return this; }
  range(...args: any[]) { this.filters.push({ kind: "range", args }); return this; }
  limit(...args: any[]) { this.filters.push({ kind: "limit", args }); return this; }
  single() { this.filters.push({ kind: "single", args: [] }); return this; }
  maybeSingle() { this.filters.push({ kind: "maybeSingle", args: [] }); return this; }

  private async exec(): Promise<ExecResult> {
    return await this.execHandler({
      table: this.table,
      op: this.op,
      payload: this.payload,
      filters: this.filters,
    });
  }

  then<TResult1 = ExecResult, TResult2 = never>(
    onfulfilled?: ((value: ExecResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled as any, onrejected as any);
  }
}

export function createMockSupabase(execHandler: SupabaseExecHandler) {
  return {
    from(table: string) {
      return new MockQuery(table, execHandler);
    },
  };
}

