"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Paginator } from "primereact/paginator";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Film, Image as ImageIcon, RefreshCw, Save, Search, Upload } from "lucide-react";
import { useToastContext } from "@/context/ToastContext";
import type {
    AdminCanonicalActionItem,
    CanonicalActionMediaStatus,
    ListAdminCanonicalActionsResponseDto,
    UploadAdminCanonicalActionMediaResponseDto,
} from "@/app/api/admin/canonical-actions/entity";
import type { CanonicalActionAuditStatus } from "@/types/canonical";
import type { ApiData } from "@/types/api";

type DraftMap = Record<string, {
    reference_image_url: string;
    reference_image_audit_status: CanonicalActionAuditStatus;
    reference_animation_url: string;
    reference_animation_audit_status: CanonicalActionAuditStatus;
}>;
type UploadingMap = Record<string, "image" | "animation" | undefined>;

const MEDIA_STATUS_OPTIONS: { label: string; value: CanonicalActionMediaStatus }[] = [
    { label: "全部", value: "all" },
    { label: "缺参考图", value: "missing_image" },
    { label: "缺缩略动画", value: "missing_animation" },
    { label: "任一缺失", value: "missing_any" },
    { label: "素材完整", value: "complete" },
];

const AUDIT_STATUS_OPTIONS: { label: string; value: CanonicalActionAuditStatus }[] = [
    { label: "未审核", value: "unreviewed" },
    { label: "审核不通过", value: "rejected" },
    { label: "审核通过", value: "approved" },
];

function auditStatusLabel(status: CanonicalActionAuditStatus) {
    if (status === "approved") return "审核通过";
    if (status === "rejected") return "审核不通过";
    return "未审核";
}

function auditStatusSeverity(status: CanonicalActionAuditStatus): "success" | "danger" | "warning" {
    if (status === "approved") return "success";
    if (status === "rejected") return "danger";
    return "warning";
}

function isVideoUrl(url: string) {
    const value = url.toLowerCase();
    return value.endsWith(".mp4") || value.endsWith(".webm") || value.includes("/videos/");
}

function emptyDraft(action: AdminCanonicalActionItem) {
    return {
        reference_image_url: action.reference_image_url || "",
        reference_image_audit_status: action.reference_image_audit_status,
        reference_animation_url: action.reference_animation_url || "",
        reference_animation_audit_status: action.reference_animation_audit_status,
    };
}

function MediaPreview(props: {
    title: string;
    url: string;
    icon: React.ReactNode;
    type: "image" | "animation";
}) {
    const { title, url, icon, type } = props;
    return (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-surface-600">
                {icon}
                <span>{title}</span>
            </div>
            {!url ? (
                <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-surface-300 text-xs text-surface-400">
                    暂无素材
                </div>
            ) : type === "animation" && isVideoUrl(url) ? (
                <video
                    controls
                    muted
                    loop
                    playsInline
                    src={url}
                    className="h-32 w-full rounded-md bg-black object-contain"
                />
            ) : (
                <img
                    src={url}
                    alt={title}
                    className="h-32 w-full rounded-md bg-white object-contain"
                />
            )}
        </div>
    );
}

export default function AdminCanonicalActionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

    const [actions, setActions] = useState<AdminCanonicalActionItem[]>([]);
    const [drafts, setDrafts] = useState<DraftMap>({});
    const [categories, setCategories] = useState<string[]>([]);
    const [summary, setSummary] = useState<ListAdminCanonicalActionsResponseDto["summary"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [uploading, setUploading] = useState<UploadingMap>({});
    const [error, setError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [mediaStatus, setMediaStatus] = useState<CanonicalActionMediaStatus>("missing_any");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [total, setTotal] = useState(0);

    const categoryOptions = useMemo(
        () => [
            { label: "全部分类", value: "" },
            ...categories.map((item) => ({ label: item, value: item })),
        ],
        [categories],
    );

    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user?.is_admin) {
            router.push("/admin/login");
        }
    }, [router, session?.user?.is_admin, status]);

    const loadActions = async () => {
        if (!session?.user?.is_admin) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                mediaStatus,
            });
            if (search) params.set("search", search);
            if (category) params.set("category", category);

            const res = await fetch(`/api/admin/canonical-actions?${params.toString()}`);
            const json = (await res.json()) as ApiData<ListAdminCanonicalActionsResponseDto>;
            if (!res.ok || !json.success || !json.data) {
                throw new Error(json.message || "加载标准动作失败");
            }
            setActions(json.data.actions);
            setTotal(json.data.total);
            setCategories(json.data.categories || []);
            setSummary(json.data.summary);
            setDrafts((prev) => {
                const next = { ...prev };
                for (const action of json.data.actions) {
                    next[action.id] = next[action.id] || emptyDraft(action);
                }
                return next;
            });
        } catch (e: any) {
            setError(e?.message || "加载标准动作失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadActions();
    }, [session?.user?.is_admin, page, limit, search, category, mediaStatus]);

    const patchDraft = (id: string, field: keyof DraftMap[string], value: string) => {
        setDrafts((prev) => ({
            ...prev,
            [id]: {
                reference_image_url: prev[id]?.reference_image_url || "",
                reference_image_audit_status: prev[id]?.reference_image_audit_status || "unreviewed",
                reference_animation_url: prev[id]?.reference_animation_url || "",
                reference_animation_audit_status: prev[id]?.reference_animation_audit_status || "unreviewed",
                [field]: value,
            },
        }));
    };

    const saveAction = async (action: AdminCanonicalActionItem) => {
        const draft = drafts[action.id] || emptyDraft(action);
        setSavingId(action.id);
        try {
            const res = await fetch("/api/admin/canonical-actions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: action.id,
                    reference_image_url: draft.reference_image_url,
                    reference_image_audit_status: draft.reference_image_audit_status,
                    reference_animation_url: draft.reference_animation_url,
                    reference_animation_audit_status: draft.reference_animation_audit_status,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success || !json.data?.action) {
                throw new Error(json.message || "保存失败");
            }
            setActions((prev) => prev.map((item) => item.id === action.id ? json.data.action : item));
            setDrafts((prev) => ({ ...prev, [action.id]: emptyDraft(json.data.action) }));
            showToast({ severity: "success", summary: "已保存", detail: action.name });
        } catch (e: any) {
            showToast({ severity: "error", summary: "保存失败", detail: e?.message || "请稍后再试" });
        } finally {
            setSavingId(null);
        }
    };

    const uploadMedia = async (action: AdminCanonicalActionItem, mediaType: "image" | "animation", file: File | null) => {
        if (!file) return;
        const key = `${action.id}:${mediaType}`;
        setUploading((prev) => ({ ...prev, [key]: mediaType }));
        try {
            const formData = new FormData();
            formData.set("file", file);
            formData.set("mediaType", mediaType);
            const res = await fetch("/api/admin/canonical-actions/upload", {
                method: "POST",
                body: formData,
            });
            const json = (await res.json()) as ApiData<UploadAdminCanonicalActionMediaResponseDto>;
            if (!res.ok || !json.success || !json.data?.url) {
                throw new Error(json.message || "上传失败");
            }
            patchDraft(
                action.id,
                mediaType === "image" ? "reference_image_url" : "reference_animation_url",
                json.data.url,
            );
            patchDraft(
                action.id,
                mediaType === "image" ? "reference_image_audit_status" : "reference_animation_audit_status",
                "unreviewed",
            );
            showToast({ severity: "success", summary: "上传成功", detail: "已回填 URL，保存后写入标准动作库" });
        } catch (e: any) {
            showToast({ severity: "error", summary: "上传失败", detail: e?.message || "请稍后再试" });
        } finally {
            setUploading((prev) => ({ ...prev, [key]: undefined }));
            const input = fileInputs.current[key];
            if (input) input.value = "";
        }
    };

    if (status === "loading" || (status === "authenticated" && !session?.user?.is_admin)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl pb-12 pt-4">
            <div className="rounded-lg border border-surface-200 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-surface-100 px-3 py-1 text-xs font-bold text-primary-600">
                            <ImageIcon className="h-4 w-4" />
                            标准动作库
                        </div>
                        <h1 className="text-2xl font-black text-surface-950">标准动作素材审核</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-surface-600">
                            审核 canonical_actions 的参考图和缩略演示动画，素材会被公共动作库详情复用。
                        </p>
                    </div>
                    <Button
                        label="刷新"
                        icon={<RefreshCw className="mr-2 h-4 w-4" />}
                        outlined
                        onClick={() => void loadActions()}
                    />
                </div>

                {summary && (
                    <div className="mt-5 grid gap-3 md:grid-cols-5">
                        <div className="rounded-lg border border-surface-200 p-3">
                            <div className="text-xl font-black">{summary.total}</div>
                            <div className="text-xs text-surface-500">当前范围</div>
                        </div>
                        <div className="rounded-lg border border-surface-200 p-3">
                            <div className="text-xl font-black text-emerald-600">{summary.withImage}</div>
                            <div className="text-xs text-surface-500">已有参考图</div>
                        </div>
                        <div className="rounded-lg border border-surface-200 p-3">
                            <div className="text-xl font-black text-emerald-600">{summary.withAnimation}</div>
                            <div className="text-xs text-surface-500">已有缩略动画</div>
                        </div>
                        <div className="rounded-lg border border-surface-200 p-3">
                            <div className="text-xl font-black text-amber-600">{summary.missingImage}</div>
                            <div className="text-xs text-surface-500">缺参考图</div>
                        </div>
                        <div className="rounded-lg border border-surface-200 p-3">
                            <div className="text-xl font-black text-amber-600">{summary.missingAnimation}</div>
                            <div className="text-xs text-surface-500">缺缩略动画</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-5 rounded-lg border border-surface-200 bg-surface p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
                    <span className="p-input-icon-left w-full">
                        <Search className="h-4 w-4" />
                        <InputText
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setPage(1);
                                    setSearch(searchInput.trim());
                                }
                            }}
                            placeholder="搜索动作名或 ID"
                            className="w-full"
                        />
                    </span>
                    <Dropdown
                        value={category}
                        options={categoryOptions}
                        onChange={(e) => {
                            setPage(1);
                            setCategory(e.value);
                        }}
                        className="w-full"
                    />
                    <Dropdown
                        value={mediaStatus}
                        options={MEDIA_STATUS_OPTIONS}
                        onChange={(e) => {
                            setPage(1);
                            setMediaStatus(e.value);
                        }}
                        className="w-full"
                    />
                    <Button
                        label="搜索"
                        icon="pi pi-search"
                        className="border-none bg-[#B4553A]"
                        onClick={() => {
                            setPage(1);
                            setSearch(searchInput.trim());
                        }}
                    />
                </div>
            </div>

            {error && (
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="mt-5 overflow-hidden rounded-lg border border-surface-200 bg-surface shadow-sm">
                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <ProgressSpinner />
                    </div>
                ) : actions.length === 0 ? (
                    <div className="p-8 text-center text-sm text-surface-500">没有匹配的标准动作</div>
                ) : (
                    <div className="divide-y divide-surface-200">
                        {actions.map((action) => {
                            const draft = drafts[action.id] || emptyDraft(action);
                            const imageUploadKey = `${action.id}:image`;
                            const animationUploadKey = `${action.id}:animation`;
                            const changed =
                                draft.reference_image_url !== (action.reference_image_url || "") ||
                                draft.reference_image_audit_status !== action.reference_image_audit_status ||
                                draft.reference_animation_url !== (action.reference_animation_url || "") ||
                                draft.reference_animation_audit_status !== action.reference_animation_audit_status;

                            return (
                                <div key={action.id} className="grid gap-4 p-4 xl:grid-cols-[minmax(220px,280px)_1fr_220px]">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate text-base font-black text-surface-950">{action.name}</h2>
                                            {action.category && <Tag value={action.category} severity="info" />}
                                        </div>
                                        <div className="mt-1 text-xs text-surface-500">{action.id}</div>
                                        {action.aliases?.length ? (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {action.aliases.slice(0, 6).map((alias) => (
                                                    <span key={alias} className="rounded-md bg-surface-100 px-2 py-1 text-xs text-surface-600">
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Tag value={action.has_reference_image ? "有参考图" : "缺参考图"} severity={action.has_reference_image ? "success" : "warning"} />
                                            <Tag value={action.has_reference_animation ? "有缩略动画" : "缺缩略动画"} severity={action.has_reference_animation ? "success" : "warning"} />
                                            <Tag value={`图：${auditStatusLabel(action.reference_image_audit_status)}`} severity={auditStatusSeverity(action.reference_image_audit_status)} />
                                            <Tag value={`动画：${auditStatusLabel(action.reference_animation_audit_status)}`} severity={auditStatusSeverity(action.reference_animation_audit_status)} />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="flex flex-col gap-2">
                                            <MediaPreview
                                                title="参考图"
                                                url={draft.reference_image_url}
                                                icon={<ImageIcon className="h-4 w-4" />}
                                                type="image"
                                            />
                                            <InputText
                                                value={draft.reference_image_url}
                                                onChange={(e) => patchDraft(action.id, "reference_image_url", e.target.value)}
                                                placeholder="粘贴参考图 URL"
                                                className="w-full text-sm"
                                            />
                                            <Dropdown
                                                value={draft.reference_image_audit_status}
                                                options={AUDIT_STATUS_OPTIONS}
                                                onChange={(e) => patchDraft(action.id, "reference_image_audit_status", e.value)}
                                                className="w-full"
                                            />
                                            <input
                                                ref={(el) => { fileInputs.current[imageUploadKey] = el; }}
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                className="hidden"
                                                onChange={(e) => void uploadMedia(action, "image", e.target.files?.[0] || null)}
                                            />
                                            <Button
                                                label={uploading[imageUploadKey] ? "上传中..." : "上传参考图"}
                                                icon={<Upload className="mr-2 h-4 w-4" />}
                                                outlined
                                                loading={uploading[imageUploadKey] === "image"}
                                                onClick={() => fileInputs.current[imageUploadKey]?.click()}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <MediaPreview
                                                title="缩略演示动画"
                                                url={draft.reference_animation_url}
                                                icon={<Film className="h-4 w-4" />}
                                                type="animation"
                                            />
                                            <InputText
                                                value={draft.reference_animation_url}
                                                onChange={(e) => patchDraft(action.id, "reference_animation_url", e.target.value)}
                                                placeholder="粘贴缩略演示动画 URL"
                                                className="w-full text-sm"
                                            />
                                            <Dropdown
                                                value={draft.reference_animation_audit_status}
                                                options={AUDIT_STATUS_OPTIONS}
                                                onChange={(e) => patchDraft(action.id, "reference_animation_audit_status", e.value)}
                                                className="w-full"
                                            />
                                            <input
                                                ref={(el) => { fileInputs.current[animationUploadKey] = el; }}
                                                type="file"
                                                accept="image/gif,image/webp,video/mp4,video/webm"
                                                className="hidden"
                                                onChange={(e) => void uploadMedia(action, "animation", e.target.files?.[0] || null)}
                                            />
                                            <Button
                                                label={uploading[animationUploadKey] ? "上传中..." : "上传缩略动画"}
                                                icon={<Upload className="mr-2 h-4 w-4" />}
                                                outlined
                                                loading={uploading[animationUploadKey] === "animation"}
                                                onClick={() => fileInputs.current[animationUploadKey]?.click()}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between gap-3">
                                        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-xs leading-5 text-surface-600">
                                            {changed ? "当前行有未保存修改。上传只会回填 URL，需要点击保存写入数据库。" : "素材 URL 与数据库一致。"}
                                        </div>
                                        <Button
                                            label="保存"
                                            icon={<Save className="mr-2 h-4 w-4" />}
                                            className="border-none bg-[#B4553A]"
                                            disabled={!changed || Boolean(savingId)}
                                            loading={savingId === action.id}
                                            onClick={() => void saveAction(action)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-4 rounded-lg border border-surface-200 bg-surface px-3 py-2">
                <Paginator
                    first={(page - 1) * limit}
                    rows={limit}
                    totalRecords={total}
                    rowsPerPageOptions={[10, 20, 50, 100]}
                    onPageChange={(event) => {
                        setPage(Math.floor(event.first / event.rows) + 1);
                        setLimit(event.rows);
                    }}
                />
            </div>
        </div>
    );
}
