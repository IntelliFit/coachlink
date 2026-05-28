"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { Database, FileText, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import { HIGH_VALUE_CONTENT_IMPORT_PRETTY_JSON } from "@/content/adminImport/highValueKnowledgePack";

type ImportResult = {
    ok: boolean;
    dryRun: boolean;
    errors: string[];
    summary: {
        planTemplates: { validated: number; upserted: number };
        books: { validated: number; upserted: number };
        articles: { validated: number; upserted: number };
    };
};

function metric(label: string, value: number, tone = "text-surface-900") {
    return (
        <div className="rounded-2xl border border-surface-200 bg-surface px-4 py-3">
            <div className={`text-2xl font-black ${tone}`}>{value}</div>
            <div className="mt-1 text-xs text-surface-500">{label}</div>
        </div>
    );
}

function ResultPanel({ result }: { result: ImportResult | null }) {
    if (!result) return null;

    return (
        <div className="mt-5 rounded-3xl border border-surface-200 bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
                {result.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <h3 className="text-lg font-bold text-surface-900">
                    {result.ok ? (result.dryRun ? "校验通过" : "导入完成") : "需要修正"}
                </h3>
                {result.dryRun && <Tag value="仅校验" severity="info" />}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {metric("计划模板校验", result.summary.planTemplates.validated)}
                {metric("文章校验", result.summary.articles.validated)}
                {metric("书籍校验", result.summary.books.validated)}
            </div>

            {!result.dryRun && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {metric("计划模板写入", result.summary.planTemplates.upserted, "text-primary-600")}
                    {metric("文章写入", result.summary.articles.upserted, "text-primary-600")}
                    {metric("书籍写入", result.summary.books.upserted, "text-primary-600")}
                </div>
            )}

            {result.errors.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="mb-2 font-bold">错误详情</div>
                    <ul className="space-y-1">
                        {result.errors.map((error, index) => (
                            <li key={`${error}-${index}`}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function AdminContentImportPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const sessionUser = session?.user as { is_admin?: boolean } | undefined;
    const [jsonText, setJsonText] = useState(HIGH_VALUE_CONTENT_IMPORT_PRETTY_JSON);
    const [publish, setPublish] = useState(true);
    const [loading, setLoading] = useState<"dry-run" | "import" | "seed" | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "loading") return;
        if (!sessionUser?.is_admin) router.push("/admin/login");
    }, [router, sessionUser?.is_admin, status]);

    const parsedStats = useMemo(() => {
        try {
            const parsed = JSON.parse(jsonText || "{}");
            return {
                valid: true,
                plans: Array.isArray(parsed?.planTemplates) ? parsed.planTemplates.length : 0,
                articles: Array.isArray(parsed?.articles) ? parsed.articles.length : 0,
                books: Array.isArray(parsed?.books) ? parsed.books.length : 0,
            };
        } catch {
            return { valid: false, plans: 0, articles: 0, books: 0 };
        }
    }, [jsonText]);

    async function submitImport(dryRun: boolean) {
        setError(null);
        setResult(null);
        let bundle: unknown;
        try {
            bundle = JSON.parse(jsonText);
        } catch (parseError: any) {
            setError(parseError?.message || "JSON 解析失败");
            return;
        }

        setLoading(dryRun ? "dry-run" : "import");
        try {
            const res = await fetch("/api/admin/content-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bundle, publish, dryRun }),
            });
            const data = await res.json();
            if (!data?.success && !data?.data) {
                throw new Error(data?.message || "导入失败");
            }
            setResult(data.data);
        } catch (requestError: any) {
            setError(requestError?.message || "导入失败");
        } finally {
            setLoading(null);
        }
    }

    async function importHighValuePack(dryRun = false) {
        setError(null);
        setResult(null);
        setLoading("seed");
        try {
            const res = await fetch("/api/admin/content-import/high-value-pack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publish, dryRun }),
            });
            const data = await res.json();
            if (!data?.success && !data?.data) {
                throw new Error(data?.message || "导入失败");
            }
            setResult(data.data);
        } catch (requestError: any) {
            setError(requestError?.message || "导入失败");
        } finally {
            setLoading(null);
        }
    }

    async function loadJsonFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setJsonText(await file.text());
            setResult(null);
            setError(null);
        } catch (fileError: any) {
            setError(fileError?.message || "读取文件失败");
        } finally {
            event.target.value = "";
        }
    }

    return (
        <div className="mx-auto max-w-6xl pb-12 pt-4">
            <section className="overflow-hidden rounded-[2rem] border border-orange-100 bg-[#fff7f2] p-8 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-600">
                            <Database className="h-4 w-4" />
                            管理员内容导入后台
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-surface-950 md:text-4xl">
                            把训练计划、文章和书籍导入知识库
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-surface-600">
                            这里走数据库和后台 API，不再把运营内容硬塞进小程序代码。训练计划导入会强制检查训练日、动作、组数、次数、休息和强度，后续从网上整理来的资料也可以先转成这个 JSON 格式再发布。
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            label="校验高价值包"
                            icon="pi pi-check"
                            outlined
                            loading={loading === "seed"}
                            onClick={() => importHighValuePack(true)}
                        />
                        <Button
                            label="导入高价值包"
                            icon="pi pi-cloud-upload"
                            className="border-none bg-[#CF6D4E]"
                            loading={loading === "seed"}
                            onClick={() => importHighValuePack(false)}
                        />
                    </div>
                </div>
            </section>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
                {metric("当前 JSON 计划", parsedStats.plans)}
                {metric("当前 JSON 文章", parsedStats.articles)}
                {metric("当前 JSON 书籍", parsedStats.books)}
                <div className="rounded-2xl border border-surface-200 bg-surface px-4 py-3">
                    <div className={parsedStats.valid ? "text-2xl font-black text-emerald-600" : "text-2xl font-black text-amber-600"}>
                        {parsedStats.valid ? "有效" : "错误"}
                    </div>
                    <div className="mt-1 text-xs text-surface-500">JSON 解析状态</div>
                </div>
            </div>

            <div className="mt-6 rounded-3xl border border-surface-200 bg-surface p-5 shadow-sm">
                <TabView>
                    <TabPanel header="JSON 导入">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox inputId="publish" checked={publish} onChange={(event) => setPublish(Boolean(event.checked))} />
                                    <label htmlFor="publish" className="text-sm font-semibold text-surface-700">
                                        导入后直接发布
                                    </label>
                                    <Tag value={publish ? "published" : "draft"} severity={publish ? "success" : "warning"} />
                                </div>
                                <div className="flex gap-2">
                                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-surface-700 transition hover:border-primary-300 hover:text-primary-600">
                                        <input type="file" accept=".json,application/json" className="hidden" onChange={loadJsonFile} />
                                        选择 JSON 文件
                                    </label>
                                    <Button
                                        label="还原示例包"
                                        icon="pi pi-refresh"
                                        text
                                        onClick={() => setJsonText(HIGH_VALUE_CONTENT_IMPORT_PRETTY_JSON)}
                                    />
                                    <Button
                                        label="先校验"
                                        icon="pi pi-search"
                                        outlined
                                        loading={loading === "dry-run"}
                                        onClick={() => submitImport(true)}
                                    />
                                    <Button
                                        label="导入当前 JSON"
                                        icon="pi pi-cloud-upload"
                                        className="border-none bg-[#CF6D4E]"
                                        loading={loading === "import"}
                                        onClick={() => submitImport(false)}
                                    />
                                </div>
                            </div>

                            <textarea
                                value={jsonText}
                                onChange={(event) => setJsonText(event.target.value)}
                                spellCheck={false}
                                className="min-h-[560px] w-full rounded-2xl border border-surface-200 bg-surface-50 p-4 font-mono text-xs leading-5 text-surface-800 outline-none transition focus:border-primary-300 focus:bg-white"
                            />
                        </div>
                    </TabPanel>
                    <TabPanel header="格式说明">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-surface-200 p-5">
                                <FileText className="mb-3 h-6 w-6 text-primary-600" />
                                <h3 className="font-bold text-surface-900">训练计划</h3>
                                <p className="mt-2 text-sm leading-6 text-surface-600">
                                    字段使用 planTemplates。每个训练日必须有连续 dayIndex；训练日 actionSets 必须写 actionName、sets、reps、rest_seconds、intensity。
                                </p>
                            </div>
                            <div className="rounded-2xl border border-surface-200 p-5">
                                <BookOpen className="mb-3 h-6 w-6 text-primary-600" />
                                <h3 className="font-bold text-surface-900">书籍笔记</h3>
                                <p className="mt-2 text-sm leading-6 text-surface-600">
                                    字段使用 books。适合放一本书的结构化读书笔记、章节摘要、音频链接和 NotebookLM 整理结果。
                                </p>
                            </div>
                            <div className="rounded-2xl border border-surface-200 p-5">
                                <Database className="mb-3 h-6 w-6 text-primary-600" />
                                <h3 className="font-bold text-surface-900">文章节点</h3>
                                <p className="mt-2 text-sm leading-6 text-surface-600">
                                    字段使用 articles。适合知识库检索、人体地图关联、体态纠正说明和专项训练理论文章。
                                </p>
                            </div>
                        </div>
                        <Message
                            className="mt-5"
                            severity="info"
                            text="建议外部资料只导入原创整理/摘要和来源线索，不要整篇复制付费书籍、课程或网页内容。"
                        />
                    </TabPanel>
                </TabView>
            </div>

            {error && (
                <div className="mt-5">
                    <Message severity="error" text={error} />
                </div>
            )}
            <ResultPanel result={result} />
        </div>
    );
}
