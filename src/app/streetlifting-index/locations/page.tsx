"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, MapPin, Search, Upload, X } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";
import { InputTextarea } from "primereact/inputtextarea";
import { InputText } from "primereact/inputtext";
import { Paginator } from "primereact/paginator";
import { Skeleton } from "primereact/skeleton";

import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import { AERO_CARD, AERO_CONTAINER_6XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";

import type { StreetliftingLocation } from "@/app/api/streetlifting-index/locations/list/entity";

const MAX_IMAGES = 4;

function getLocationImages(loc: StreetliftingLocation): string[] {
    if (loc.image_urls && loc.image_urls.length > 0) return loc.image_urls;
    if (loc.image_url) return [loc.image_url];
    return [];
}

export default function StreetliftingLocationsPage() {
    const { showToast } = useToastContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<StreetliftingLocation[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [first, setFirst] = useState(0);
    const rows = 30;
    const [provinceOptions, setProvinceOptions] = useState<string[]>(["all"]);

    const [search, setSearch] = useState("");
    const [province, setProvince] = useState<string>("all");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<StreetliftingLocation | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [form, setForm] = useState({
        name: "",
        description: "",
        address: "",
        city: "",
        province: "",
    });
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const fetchLocations = async (page: number) => {
        setLoading(true);
        try {
            const data = await streetliftingIndexService.listLocations({
                page,
                limit: rows,
                search: search.trim() || undefined,
                province: province || undefined,
            });
            setLocations(data?.locations || []);
            setTotalCount(data?.pagination?.total || 0);
            setProvinceOptions(["all", ...(data?.provinces || [])]);
        } catch (e: any) {
            console.error("[streetlifting-index][locations] list error:", e);
            showToast({ severity: "warn", summary: "提示", detail: "地点加载失败" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 初次加载
        fetchLocations(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 搜索/筛选变化：回到第一页（参考 coach/discovery 的分页交互）
    useEffect(() => {
        const t = setTimeout(() => {
            setFirst(0);
            fetchLocations(1);
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, province]);

    const resetForm = () => {
        setEditing(null);
        setForm({ name: "", description: "", address: "", city: "", province: "" });
        setImagePreviews([]);
        setImageUrls([]);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const openCreate = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEdit = (loc: StreetliftingLocation) => {
        const imgs = getLocationImages(loc);
        setEditing(loc);
        setForm({
            name: loc.name,
            description: loc.description || "",
            address: loc.address || "",
            city: loc.city || "",
            province: loc.province || "",
        });
        setImageUrls(imgs);
        setImagePreviews(imgs);
        setDialogOpen(true);
    };

    const removeImage = (index: number) => {
        setImagePreviews((p) => p.filter((_, i) => i !== index));
        setImageUrls((p) => p.filter((_, i) => i !== index));
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const remaining = MAX_IMAGES - imageUrls.length;
        if (remaining <= 0) {
            showToast({ severity: "warn", summary: "提示", detail: `最多只能上传${MAX_IMAGES}张图片` });
            return;
        }

        const toUpload = Array.from(files).slice(0, remaining);
        setUploading(true);

        try {
            for (const file of toUpload) {
                // 先本地预览
                const localUrl = URL.createObjectURL(file);
                setImagePreviews((p) => [...p, localUrl]);

                const resp = await streetliftingIndexService.uploadLocationImage(file);
                if (resp?.url) {
                    setImageUrls((p) => [...p, resp.url]);
                } else {
                    showToast({ severity: "warn", summary: "上传失败", detail: "未拿到图片地址" });
                }
            }
        } catch (e: any) {
            console.error("[streetlifting-index][locations] upload error:", e);
            showToast({ severity: "error", summary: "上传失败", detail: e?.message || "请稍后重试" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            if (!form.name.trim()) throw new Error("请填写地点名称");

            if (editing) {
                await streetliftingIndexService.updateLocation({
                    id: editing.id,
                    name: form.name.trim(),
                    description: form.description || null,
                    address: form.address || null,
                    city: form.city || null,
                    province: form.province || null,
                    image_urls: imageUrls.length ? imageUrls : null,
                });
                showToast({ severity: "success", summary: "保存成功", detail: "地点已更新" });
            } else {
                await streetliftingIndexService.createLocation({
                    name: form.name.trim(),
                    description: form.description || null,
                    address: form.address || null,
                    city: form.city || null,
                    province: form.province || null,
                    image_urls: imageUrls.length ? imageUrls : null,
                });
                showToast({ severity: "success", summary: "提交成功", detail: "感谢你的分享" });
            }

            setDialogOpen(false);
            resetForm();
            await fetchLocations(Math.floor(first / rows) + 1);
        } catch (e: any) {
            showToast({ severity: "warn", summary: "操作失败", detail: e?.message || "请稍后重试" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleShare = async (loc: StreetliftingLocation) => {
        const addressPart = [loc.province, loc.city, loc.address].filter(Boolean).join(" ");
        const shareText = `🏋️ 发现单杠训练点：${loc.name}\n📍 地址：${addressPart || "暂无详细地址"}\n${loc.description ? `💬 描述：${loc.description}\n` : ""}🔗 更多：${window.location.origin}/streetlifting-index/locations`;
        try {
            await navigator.clipboard.writeText(shareText);
            showToast({ severity: "success", summary: "已复制", detail: "分享文案已复制到剪贴板" });
        } catch {
            showToast({ severity: "warn", summary: "复制失败", detail: "请手动复制分享内容" });
        }
    };

    const openGallery = (images: string[], index: number) => {
        setGalleryImages(images);
        setGalleryIndex(index);
        setGalleryOpen(true);
    };

    const nextImg = () => setGalleryIndex((p) => (p + 1) % galleryImages.length);
    const prevImg = () => setGalleryIndex((p) => (p - 1 + galleryImages.length) % galleryImages.length);

    const dropdownClassName = "w-full h-10 rounded-2xl bg-surface-0 border border-surface-200";
    const dropdownPanelClassName = "rounded-2xl border border-surface-100 bg-surface-0 shadow-xl";
    const dropdownIcon = () => <span className="pi pi-chevron-down text-surface-400" />;
    const dropdownPt = {
        input: { className: "py-2 px-3 text-sm font-semibold text-surface-800" },
        trigger: { className: "w-10" },
    } as const;

    const renderAeroDropdownValue = (option: any, props?: any) => {
        const label = option?.label ?? props?.placeholder ?? "请选择";
        const isPlaceholder = !option;
        return (
            <div className="min-w-0 flex items-center gap-2">
                <span className={`truncate text-sm font-semibold ${isPlaceholder ? "text-surface-500" : "text-surface-800"}`}>{label}</span>
            </div>
        );
    };

    const makeAeroDropdownItemTemplate =
        (currentValue: any) =>
        (option: any) => {
            const label = option?.label ?? String(option ?? "");
            const value = option?.value ?? option;
            const isActive = currentValue === value;
            return (
                <div
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl ${
                        isActive ? "bg-surface-100 text-surface-900" : "text-surface-700"
                    }`}
                >
                    <span className={`min-w-0 truncate text-sm ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
                    <span className={`shrink-0 text-[10px] font-black ${isActive ? "text-primary-600" : "text-surface-300"}`}>●</span>
                </div>
            );
        };

    const textInputClassName =
        "w-full h-10 rounded-2xl border border-surface-200 bg-surface-0 px-3 text-sm font-semibold text-surface-800 placeholder:text-surface-400 focus:outline-none focus:border-primary-200";
    const textareaClassName =
        "w-full rounded-2xl border border-surface-200 bg-surface-0 px-3 py-2 text-sm font-semibold text-surface-800 placeholder:text-surface-400 focus:outline-none focus:border-primary-200";

    return (
        <div className={`${AERO_CONTAINER_6XL} py-6 space-y-6`}>
            <Card className={AERO_CARD}>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className={AERO_TITLE}>寻找单杠</div>
                                <div className={AERO_SUBTITLE}>分享你发现的训练点，帮助更多人找到场地。</div>
                            </div>
                            <Button
                                label="分享单杠位置"
                                icon="pi pi-plus"
                                onClick={openCreate}
                                className="h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <IconField iconPosition="left" className="w-full group md:col-span-2">
                                <InputIcon className="z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                    <Search size={18} strokeWidth={2.5} />
                                </InputIcon>
                                <InputText
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={`${textInputClassName} pl-11`}
                                    placeholder="搜索地点名称/省市/地址/描述…"
                                />
                            </IconField>
                            <Dropdown
                                value={province}
                                options={provinceOptions.map((p) => ({
                                    label: p === "all" ? "全部省份" : p,
                                    value: p,
                                }))}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(province)}
                                onChange={(e) => setProvince(e.value)}
                                placeholder="省份"
                            />
                        </div>

                        <div className="text-sm text-surface-500">找到 {totalCount} 个地点</div>
                    </div>
            </Card>

                {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className={AERO_CARD}>
                                <div className="p-4 space-y-3">
                                    <Skeleton width="100%" height="9rem" />
                                    <Skeleton width="60%" height="1rem" />
                                    <Skeleton width="90%" height="0.9rem" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : locations.length === 0 ? (
                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-10 text-center text-surface-500">
                        <div className="text-base font-semibold text-surface-900 mb-2">暂无地点信息</div>
                        <div className="text-sm">成为第一个分享者吧！</div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {locations.map((loc) => (
                            <LocationCard
                                key={loc.id}
                                loc={loc}
                                onEdit={openEdit}
                                onShare={handleShare}
                                onOpenGallery={openGallery}
                            />
                        ))}
                    </div>
                )}

                <div className="pt-2">
                    <Paginator
                        first={first}
                        rows={rows}
                        totalRecords={totalCount}
                        onPageChange={(e) => {
                            setFirst(e.first);
                            fetchLocations(e.page + 1);
                        }}
                        className="bg-transparent border-none py-6"
                    />
                </div>

            {/* 新增/编辑 */}
            <Dialog
                header={editing ? "编辑单杠位置" : "分享单杠位置"}
                visible={dialogOpen}
                onHide={() => {
                    setDialogOpen(false);
                    resetForm();
                }}
                className="aero-dialog w-[95vw] md:w-[34rem]"
                draggable={false}
                style={{ maxHeight: "90vh" }}
            >
                <div className="space-y-4">
                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">地点名称 *</div>
                        <InputText
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            className={textInputClassName}
                            placeholder="例如：朝阳公园健身区"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="text-xs text-surface-500 mb-1.5">省份</div>
                            <InputText
                                value={form.province}
                                onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                                className={textInputClassName}
                                placeholder="例如：北京市"
                            />
                        </div>
                        <div>
                            <div className="text-xs text-surface-500 mb-1.5">城市/区</div>
                            <InputText
                                value={form.city}
                                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                                className={textInputClassName}
                                placeholder="例如：朝阳区"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">详细地址</div>
                        <InputText
                            value={form.address}
                            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                            className={textInputClassName}
                            placeholder="例如：东门进来右手边"
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">描述</div>
                        <InputTextarea
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            className={textareaClassName}
                            rows={3}
                            autoResize
                            placeholder="例如：单杠高度/数量/手感/安全性…"
                        />
                    </div>

                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-surface-900">图片（最多{MAX_IMAGES}张）</div>
                            <div className="text-xs text-surface-500">
                                {imageUrls.length}/{MAX_IMAGES}
                            </div>
                        </div>

                        {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                                {imagePreviews.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-surface-100 bg-surface-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover object-center block" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-1 right-1 bg-surface-900/70 text-surface-0 rounded-full p-1"
                                            aria-label="remove"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {imageUrls.length < MAX_IMAGES && (
                            <div className="flex items-center gap-3 flex-wrap">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleUpload(e.target.files)}
                                />
                                <Button
                                    label={uploading ? "上传中..." : "选择图片"}
                                    icon={<Upload className="h-4 w-4" />}
                                    outlined
                                    severity="secondary"
                                    className="h-10 rounded-2xl border-surface-200 text-surface-800 hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                                    disabled={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                />
                                <div className="text-xs text-surface-500">
                                    建议单张 ≤ 5MB（支持 JPG/PNG/WebP/GIF）
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button
                            label="取消"
                            outlined
                            severity="secondary"
                            size="small"
                            className="h-10 rounded-2xl border-surface-200 text-surface-800 hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                            onClick={() => {
                                setDialogOpen(false);
                                resetForm();
                            }}
                        />
                        <Button
                            label={submitting ? "提交中..." : editing ? "保存修改" : "提交"}
                            disabled={uploading || submitting}
                            size="small"
                            className="h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                            onClick={handleSubmit}
                        />
                    </div>
                </div>
            </Dialog>

            {/* 画廊 */}
            <Dialog
                header="图片预览"
                visible={galleryOpen}
                onHide={() => setGalleryOpen(false)}
                className="aero-dialog w-[95vw] md:w-[48rem]"
                draggable={false}
            >
                {galleryImages.length > 0 && (
                    <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden border border-surface-100 bg-black/95">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={galleryImages[galleryIndex]}
                                alt="gallery"
                                className="w-full h-[70vh] object-cover object-center block"
                            />
                            {galleryImages.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImg}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
                                        aria-label="prev"
                                    >
                                        <ChevronLeft className="h-6 w-6" />
                                    </button>
                                    <button
                                        onClick={nextImg}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
                                        aria-label="next"
                                    >
                                        <ChevronRight className="h-6 w-6" />
                                    </button>
                                </>
                            )}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white bg-black/50 rounded-full px-3 py-1">
                                {galleryIndex + 1} / {galleryImages.length}
                            </div>
                        </div>
                        {galleryImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {galleryImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setGalleryIndex(idx)}
                                        className={`h-14 w-14 rounded-2xl overflow-hidden border ${
                                            idx === galleryIndex ? "border-primary-500" : "border-surface-100"
                                        }`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={`thumb-${idx}`} className="h-full w-full object-cover object-center block" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
    );
}

function LocationCard({
    loc,
    onEdit,
    onShare,
    onOpenGallery,
}: {
    loc: StreetliftingLocation;
    onEdit: (loc: StreetliftingLocation) => void;
    onShare: (loc: StreetliftingLocation) => void;
    onOpenGallery: (images: string[], index: number) => void;
}) {
    const [idx, setIdx] = useState(0);
    const images = getLocationImages(loc);
    const [loaded, setLoaded] = useState<Record<number, boolean>>({});

    const canPrev = images.length > 1;
    const next = () => setIdx((p) => (p + 1) % images.length);
    const prev = () => setIdx((p) => (p - 1 + images.length) % images.length);

    useEffect(() => {
        // 预加载，避免点击后“footer 已变但图片迟迟不动/过一会才跳变”的观感
        if (!images || images.length === 0) return;
        images.forEach((url, i) => {
            const img = new Image();
            img.onload = () => setLoaded((p) => (p[i] ? p : { ...p, [i]: true }));
            img.onerror = () => setLoaded((p) => (p[i] ? p : { ...p, [i]: true })); // 失败也放行，避免卡死
            img.src = url;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loc.id, images.length]);

    return (
        <Card className={`${AERO_CARD} overflow-hidden border-surface-100 hover:border-surface-200 active:scale-[0.98] transition-[box-shadow,transform,border-color]`}>
            <div
                className="relative aspect-video bg-surface-100 cursor-pointer"
                onClick={() => (images.length ? onOpenGallery(images, idx) : onEdit(loc))}
            >
                {images.length ? (
                    <>
                        {/* 轮播轨道：transform 动画，响应更及时 */}
                        <div
                            className="absolute inset-0 flex transition-transform duration-300 ease-out will-change-transform"
                            style={{ transform: `translateX(-${idx * 100}%)` }}
                        >
                            {images.map((url, i) => (
                                <div key={`${url}-${i}`} className="w-full h-full shrink-0 relative">
                                    {!loaded[i] && <div className="absolute inset-0 bg-surface-200/60 animate-pulse" />}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`${loc.name}-${i + 1}`}
                                        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded[i] ? "opacity-100" : "opacity-0"}`}
                                        loading={i === 0 ? "eager" : "lazy"}
                                        decoding="async"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* 轻微品牌色点睛：顶部高光（克制，不铺色） */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-primary-100/35 to-transparent" />

                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface-900/55 text-surface-0 rounded-full p-1.5 active:scale-[0.98] transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        prev();
                                    }}
                                    aria-label="prev"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-900/55 text-surface-0 rounded-full p-1.5 active:scale-[0.98] transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        next();
                                    }}
                                    aria-label="next"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </>
                        )}
                        <div className="absolute bottom-2 right-2 text-xs text-white bg-black/45 rounded-full px-2 py-1">
                            {idx + 1}/{images.length}
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-surface-600">
                        <Camera className="h-10 w-10 text-surface-400" />
                        <div className="text-sm font-medium">待补充图片</div>
                        <div className="text-xs">点击添加</div>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center border border-primary-100">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-semibold text-surface-900 line-clamp-1 flex items-center gap-2">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                {loc.name}
                            </div>
                            <div className="text-xs text-surface-500">
                                {[loc.province, loc.city].filter(Boolean).join(" · ")}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            text
                            severity="secondary"
                            size="small"
                            icon="pi pi-pencil"
                            className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                            onClick={(e) => {
                                e.preventDefault();
                                onEdit(loc);
                            }}
                        />
                        <Button
                            text
                            severity="secondary"
                            size="small"
                            icon="pi pi-share-alt"
                            className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                            onClick={(e) => {
                                e.preventDefault();
                                onShare(loc);
                            }}
                        />
                    </div>
                </div>

                {loc.address && <div className="text-sm text-surface-700">{loc.address}</div>}
                {loc.description && <div className="text-sm text-surface-600 line-clamp-3">{loc.description}</div>}

                <div className="text-[11px] text-surface-400">
                    {new Date(loc.created_at).toLocaleDateString("zh-CN")}
                </div>
            </div>
        </Card>
    );
}

