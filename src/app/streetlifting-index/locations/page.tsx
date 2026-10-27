"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MapPin, Search, Upload, X } from "lucide-react";
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

import MapLocationPicker from "@/components/MapLocationPicker";
import CityPicker from "@/components/CityPicker";
import TianDiTuLocationsMap from "@/components/TianDiTuLocationsMap";
import { useToastContext } from "@/context/ToastContext";
import { toTianDiTuCoordinates, wgs84ToGcj02, type LocationCoordinateSystem } from "@coachlink/core";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import { AERO_CARD, AERO_CONTAINER_6XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";
import { StreetliftingLocationOverview } from "@/components/streetlifting-index/StreetliftingLocationOverview";

import type { StreetliftingLocation } from "@/app/api/streetlifting-index/locations/list/entity";
import type { StreetliftingLocationContributorItem } from "@/app/api/streetlifting-index/locations/contributors/entity";
import type { StreetliftingLocationOverviewStats } from "@/app/api/streetlifting-index/stats/entity";

const MAX_IMAGES = 4;

/** Stored point → Baidu BD-09 Mercator for the map.baidu.com URL (@mcX,mcY,zoom).
 * GCJ-02 (mini-program) points skip the WGS84 step; untagged points keep the web's
 * historical WGS84 assumption. */
function toBd09mc(loc: Pick<StreetliftingLocation, "coordinate_system"> & { latitude: number; longitude: number }): [number, number] {
    const gcj = loc.coordinate_system === "gcj02" ? loc : wgs84ToGcj02(loc);
    const z = Math.sqrt(gcj.longitude * gcj.longitude + gcj.latitude * gcj.latitude) + 0.00002 * Math.sin(gcj.latitude * Math.PI * 3000 / 180);
    const theta = Math.atan2(gcj.latitude, gcj.longitude) + 0.000003 * Math.cos(gcj.longitude * Math.PI * 3000 / 180);
    const bdLon = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;

    const mcX = bdLon * 20037508.34 / 180;
    let mcY = Math.log(Math.tan((90 + bdLat) * Math.PI / 360)) / (Math.PI / 180);
    mcY = mcY * 20037508.34 / 180;
    return [mcX, mcY];
}

/** Position shown in the Tianditu (WGS84) picker for a stored point. */
function toPickerPosition(loc: StreetliftingLocation): { latitude: number | null; longitude: number | null } {
    if (loc.latitude == null || loc.longitude == null) return { latitude: null, longitude: null };
    const shown = toTianDiTuCoordinates({ ...loc, latitude: loc.latitude, longitude: loc.longitude });
    return { latitude: shown.latitude, longitude: shown.longitude };
}

/** What to save: a point the user did not move keeps its stored coordinates and tag;
 * a point picked on Tianditu is WGS84. */
function toSavedPosition(
    form: { latitude: number | null; longitude: number | null },
    original: StreetliftingLocation | null,
): { latitude: number | null; longitude: number | null; coordinate_system: LocationCoordinateSystem | null } {
    if (form.latitude == null || form.longitude == null) return { latitude: null, longitude: null, coordinate_system: null };
    if (original?.latitude != null && original.longitude != null) {
        const shown = toPickerPosition(original);
        if (shown.latitude === form.latitude && shown.longitude === form.longitude) {
            return { latitude: original.latitude, longitude: original.longitude, coordinate_system: original.coordinate_system ?? null };
        }
    }
    return { latitude: form.latitude, longitude: form.longitude, coordinate_system: "wgs84" };
}

function getLocationImages(loc: StreetliftingLocation): string[] {
    if (loc.image_urls && loc.image_urls.length > 0) return loc.image_urls;
    if (loc.image_url) return [loc.image_url];
    return [];
}

function maskPhone(value: string): string {
    return value.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function maskEmail(value: string): string {
    const [name, domain] = value.split("@");
    if (!name || !domain) return value;
    if (name.length <= 2) return `${name[0] || "*"}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
}

function formatContributorName(value?: string | null): string {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "未署名贡献者";
    if (/^1\d{10}$/.test(trimmed)) return maskPhone(trimmed);
    if (trimmed.includes("@")) return maskEmail(trimmed);
    return trimmed;
}

export default function StreetliftingLocationsPage() {
    const { showToast } = useToastContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<StreetliftingLocation[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [first, setFirst] = useState(0);
    const rows = 30;

    const [search, setSearch] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [filterProvince, setFilterProvince] = useState("");
    const [filterCity, setFilterCity] = useState("");
    const [filterCounty, setFilterCounty] = useState("");
    // CityPicker 使用的组合值 "省-市-区"
    const [filterCityPickerValue, setFilterCityPickerValue] = useState("");

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
        county: "",
        latitude: null as number | null,
        longitude: null as number | null,
    });
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const [viewMode, setViewMode] = useState<"list" | "map">("list");
    const [contributors, setContributors] = useState<StreetliftingLocationContributorItem[]>([]);
    const [loadingContributors, setLoadingContributors] = useState(true);
    const [contributorsExpanded, setContributorsExpanded] = useState(false);
    const [locationOverview, setLocationOverview] = useState<StreetliftingLocationOverviewStats | null>(null);
    const [loadingLocationOverview, setLoadingLocationOverview] = useState(true);

    const fetchLocations = async (page: number) => {
        setLoading(true);
        try {
            const data = await streetliftingIndexService.listLocations({
                page,
                limit: rows,
                search: submittedSearch.trim() || undefined,
                province: filterProvince || undefined,
                city: filterCity || undefined,
                county: filterCounty || undefined,
            });
            setLocations(data?.locations || []);
            setTotalCount(data?.pagination?.total || 0);
        } catch (e: any) {
            console.error("[streetlifting-index][locations] list error:", e);
            showToast({ severity: "warn", summary: "提示", detail: "地点加载失败" });
        } finally {
            setLoading(false);
        }
    };

    const loadContributorLeaderboard = async () => {
        setLoadingContributors(true);
        try {
            const data = await streetliftingIndexService.listLocationContributors();
            setContributors(data?.contributors || []);
        } catch (e: any) {
            console.error("[streetlifting-index][locations] contributors error:", e);
            showToast({ severity: "warn", summary: "提示", detail: "贡献榜加载失败" });
        } finally {
            setLoadingContributors(false);
        }
    };

    const loadLocationOverview = async () => {
        setLoadingLocationOverview(true);
        try {
            const data = await streetliftingIndexService.getStats();
            setLocationOverview(data?.locationOverview ?? null);
        } catch (e: any) {
            console.error("[streetlifting-index][locations] stats error:", e);
            setLocationOverview(null);
        } finally {
            setLoadingLocationOverview(false);
        }
    };

    useEffect(() => {
        // 初次加载
        fetchLocations(1);
        loadContributorLeaderboard();
        loadLocationOverview();
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
    }, [submittedSearch, filterProvince, filterCity, filterCounty]);

    const submitSearch = () => {
        setSubmittedSearch(search.trim());
    };

    const clearFilters = () => {
        setSearch("");
        setSubmittedSearch("");
        setFilterCityPickerValue("");
        setFilterProvince("");
        setFilterCity("");
        setFilterCounty("");
    };

    const resetForm = () => {
        setEditing(null);
        setForm({
            name: "",
            description: "",
            address: "",
            city: "",
            province: "",
            county: "",
            latitude: null,
            longitude: null,
        });
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
            county: loc.county || "",
            ...toPickerPosition(loc),
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
            if (!form.province) throw new Error("请选择省份");
            if (!form.city) throw new Error("请选择城市");
            if (!form.county) throw new Error("请选择区/县");
            const savedPosition = toSavedPosition(form, editing);

                    if (editing) {
                await streetliftingIndexService.updateLocation({
                    id: editing.id,
                    name: form.name.trim(),
                    description: form.description || null,
                    address: form.address || null,
                    city: form.city || null,
                    province: form.province || null,
                    county: form.county || null,
                    ...savedPosition,
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
                    county: form.county || null,
                    ...savedPosition,
                    image_urls: imageUrls.length ? imageUrls : null,
                });
                showToast({ severity: "success", summary: "提交成功", detail: "感谢你的分享" });
            }

            setDialogOpen(false);
            resetForm();
            await fetchLocations(Math.floor(first / rows) + 1);
            await loadContributorLeaderboard();
            await loadLocationOverview();
        } catch (e: any) {
            showToast({ severity: "warn", summary: "操作失败", detail: e?.message || "请稍后重试" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleShare = async (loc: StreetliftingLocation) => {
        const addressPart = [loc.province, loc.city, loc.county, loc.address].filter(Boolean).join(" ");
        const shareText = `🏋️ 发现单杠训练点：${loc.name}\n📍 地址：${addressPart || "暂无详细地址"}\n${loc.description ? `💬 描述：${loc.description}\n` : ""}🔗 更多：${window.location.origin}/streetlifting-index/locations`;
        try {
            await navigator.clipboard.writeText(shareText);
            showToast({ severity: "success", summary: "已复制", detail: "分享文案已复制到剪贴板" });
        } catch {
            showToast({ severity: "warn", summary: "复制失败", detail: "请手动复制分享内容" });
        }
    };

    const handleGoToMap = (loc: StreetliftingLocation) => {
        const addressPart = [loc.province, loc.city, loc.county, loc.address].filter(Boolean).join("");
        const encodedAddress = encodeURIComponent(addressPart);
        let url: string;
        if (loc.latitude != null && loc.longitude != null) {
            const [mcX, mcY] = toBd09mc({ ...loc, latitude: loc.latitude, longitude: loc.longitude });
            url = `https://map.baidu.com/search/${encodedAddress}/@${mcX.toFixed(2)},${mcY.toFixed(2)},15z?querytype=s&da_src=shareurl&wd=${encodedAddress}&src=0&pn=0&sug=0&from=webmap`;
        } else {
            url = `https://map.baidu.com/search/${encodedAddress}/?querytype=s&da_src=shareurl&wd=${encodedAddress}&src=0&pn=0&sug=0&from=webmap`;
        }
        window.open(url, "_blank");
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

    const hasMoreContributors = contributors.length > 3;
    const visibleContributors = useMemo(
        () => (contributorsExpanded ? contributors : contributors.slice(0, 3)),
        [contributors, contributorsExpanded],
    );

    // 地图模式：锁定 body 滚动，防止页面出现滚动条
    useEffect(() => {
        if (viewMode === "map") {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [viewMode]);

    /** 视图切换按钮组（两种模式均复用） */
    const viewToggle = (
        <div className="flex items-center rounded-2xl border border-surface-200 bg-surface-50 p-1 gap-1">
            <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    viewMode === "list"
                        ? "bg-surface-900 text-surface-0 shadow-sm"
                        : "text-surface-500 hover:text-surface-800"
                }`}
            >
                列表
            </button>
            <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    viewMode === "map"
                        ? "bg-surface-900 text-surface-0 shadow-sm"
                        : "text-surface-500 hover:text-surface-800"
                }`}
            >
                地图
            </button>
        </div>
    );

    if (viewMode === "map") {
        return (
            <div className="fixed inset-0 z-40">
                {/* 地图铺满全屏 */}
                <TianDiTuLocationsMap className="h-full" />

                {/* 悬浮在地图上方、导航栏正下方，居中展示；z-[9999] 压过天地图注入的高层级 DOM */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-surface-0/90 backdrop-blur-md rounded-2xl shadow-lg px-3 py-2 border border-surface-100">
                    <span className="text-sm font-black text-surface-900 whitespace-nowrap">寻找单杠</span>
                    <div className="w-px h-4 bg-surface-200" />
                    {viewToggle}
                </div>

                {/* 对话框仍然需要渲染（分享位置弹窗） */}
                {renderDialogs()}
            </div>
        );
    }

    return (
        <div className={`${AERO_CONTAINER_6XL} py-6 space-y-6`}>
            <Card className={AERO_CARD}>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className={AERO_TITLE}>寻找单杠</div>
                                <div className={AERO_SUBTITLE}>分享你发现的训练点，帮助更多人找到场地。</div>
                            </div>
                            <div className="flex items-center gap-3">
                                {viewToggle}
                                <Button
                                    label="分享单杠位置"
                                    icon="pi pi-plus"
                                    onClick={openCreate}
                                    className="h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                                />
                            </div>
                        </div>

                        {viewMode === "list" && (
                            <>
                                <div className="flex flex-col gap-3">
                                    <CityPicker
                                        value={filterCityPickerValue}
                                        onChange={(val) => {
                                            setFilterCityPickerValue(val);
                                            const parts = val.split("-").map((s) => s.trim());
                                            setFilterProvince(parts[0] || "");
                                            setFilterCity(parts[1] || "");
                                            setFilterCounty(parts[2] || "");
                                        }}
                                    />
                                    <div className="flex gap-3 items-center">
                                        <IconField iconPosition="left" className="flex-1 group">
                                            <InputIcon className="z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                                <Search size={18} strokeWidth={2.5} />
                                            </InputIcon>
                                            <InputText
                                                value={search}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setSearch(value);
                                                    if (!value) {
                                                        setSubmittedSearch("");
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        submitSearch();
                                                    }
                                                }}
                                                className={`${textInputClassName} pl-11`}
                                                placeholder="搜索地点名称/描述…"
                                            />
                                        </IconField>
                                        <Button
                                            type="button"
                                            label={'\u641c\u7d22'}
                                            icon="pi pi-search"
                                            onClick={submitSearch}
                                            className="shrink-0 h-10 rounded-2xl bg-primary border-none text-surface-0 text-sm font-black hover:bg-primary-600 active:opacity-80 transition-all"
                                        />
                                        {(filterCityPickerValue || search || submittedSearch) && (
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="shrink-0 text-xs text-surface-500 hover:text-surface-800 flex items-center gap-1 transition-colors"
                                            >
                                                <X size={14} />
                                                清除
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="text-sm text-surface-500">找到 {totalCount} 个地点</div>
                            </>
                        )}
                    </div>
            </Card>

            <StreetliftingLocationOverview loading={loadingLocationOverview} overview={locationOverview} />

            <Card className={AERO_CARD}>
                <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-lg font-black tracking-tight text-surface-900">单杠贡献排行榜</div>
                            <div className="text-sm text-surface-500 mt-1">直接读取后端聚合贡献表，按上传次数、信息详细度和图片贡献综合排序。</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-right">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">权益方向</div>
                            <div className="text-sm font-semibold text-emerald-800">后续可映射徽章、资料兑换、内测优先权</div>
                        </div>
                    </div>

                    {loadingContributors ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="rounded-3xl border border-surface-100 bg-surface-50 p-4 space-y-3">
                                    <Skeleton width="40%" height="1rem" />
                                    <Skeleton width="75%" height="0.9rem" />
                                </div>
                            ))}
                        </div>
                    ) : visibleContributors.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-5 py-6 text-sm text-surface-500">
                            当前还没有足够的贡献数据，新的单杠分享会自动进入累计。
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {visibleContributors.map((item, index) => (
                                <div
                                    key={item.contributor_key}
                                    className="rounded-3xl border border-surface-100 bg-gradient-to-r from-surface-0 to-emerald-50/60 p-4 shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-bold text-surface-900">
                                                    {formatContributorName(item.display_name)}
                                                </div>
                                                <div className="mt-1 text-sm text-surface-500">
                                                    {item.upload_count} 次上传 · 详细度 {item.detail_score_total} 分 · {item.image_count_total} 张图
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-2xl font-black text-emerald-700">{item.contribution_score}</div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">贡献分</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {hasMoreContributors && (
                                <button
                                    type="button"
                                    onClick={() => setContributorsExpanded((prev) => !prev)}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm font-semibold text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-900"
                                >
                                    {contributorsExpanded ? (
                                        <>
                                            收起贡献榜
                                            <ChevronUp size={16} />
                                        </>
                                    ) : (
                                        <>
                                            展开全部 {contributors.length} 位贡献者
                                            <ChevronDown size={16} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </Card>

                <>
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
                                        onGoToMap={handleGoToMap}
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
                    </>

            {renderDialogs()}
        </div>
    );

    function renderDialogs() { return (<>
            {/* 新增/编辑 */}
            <Dialog
                header={editing ? "编辑单杠位置" : "分享单杠位置"}
                visible={dialogOpen}
                onHide={() => {
                    setDialogOpen(false);
                    resetForm();
                }}
                blockScroll
                className="aero-dialog w-[95vw] md:w-[42rem]"
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

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">地理位置 *</div>
                        <MapLocationPicker
                            value={{
                                province: form.province,
                                city: form.city,
                                county: form.county,
                                address: form.address,
                                latitude: form.latitude,
                                longitude: form.longitude,
                            }}
                            onChange={(val) => {
                                setForm((p) => ({
                                    ...p,
                                    province: val.province || "",
                                    city: val.city || "",
                                    county: val.county || "",
                                    address: val.address || "",
                                    latitude: val.latitude ?? null,
                                    longitude: val.longitude ?? null,
                                }));
                            }}
                            cityLabel=""
                            addressLabel=""
                            mapLabel=""
                            requireCityForMap={false}
                            mapHeight="240px"
                            className="bg-surface-50 p-4 rounded-2xl border border-surface-100"
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
                blockScroll
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
    </>); }
}

function LocationCard({
    loc,
    onEdit,
    onShare,
    onGoToMap,
    onOpenGallery,
}: {
    loc: StreetliftingLocation;
    onEdit: (loc: StreetliftingLocation) => void;
    onShare: (loc: StreetliftingLocation) => void;
    onGoToMap: (loc: StreetliftingLocation) => void;
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
        <Card className={`${AERO_CARD} h-full flex flex-col overflow-hidden border-surface-100 hover:border-surface-200 active:scale-[0.98] transition-[box-shadow,transform,border-color] [&>.p-card-body]:flex [&>.p-card-body]:flex-col [&>.p-card-body]:flex-1 [&>.p-card-body]:p-0 [&>.p-card-body>.p-card-content]:flex [&>.p-card-body>.p-card-content]:flex-col [&>.p-card-body>.p-card-content]:flex-1 [&>.p-card-body>.p-card-content]:p-0`}>
            <div
                className="relative aspect-video bg-surface-100 cursor-pointer shrink-0"
                onClick={() => (images.length ? onOpenGallery(images, idx) : onEdit(loc))}
            >
                {/* ... existing image carousel code ... */}
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

            <div className="p-4 flex-1 flex flex-col min-h-0">
                <div className="space-y-3 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center border border-primary-100 shrink-0">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-semibold text-surface-900 truncate flex items-center gap-2">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                                    {loc.name}
                                </div>
                                <div className="text-xs text-surface-500 truncate">
                                    {[loc.province, loc.city, loc.county].filter(Boolean).join(" · ")}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
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

                    {loc.address && <div className="text-sm text-surface-700 line-clamp-1">{loc.address}</div>}
                    {loc.description && <div className="text-sm text-surface-600 line-clamp-2">{loc.description}</div>}
                </div>

                <div className="flex items-center justify-between gap-3 pt-4 mt-auto">
                    <div className="text-[11px] text-surface-400">
                        {new Date(loc.created_at).toLocaleDateString("zh-CN")}
                    </div>
                    <button
                        type="button"
                        onClick={() => onGoToMap(loc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 active:scale-[0.98] transition-all"
                    >
                        <MapPin size={14} className="text-primary-600" />
                        <span className="text-xs font-bold">点击前往</span>
                    </button>
                </div>
            </div>
        </Card>
    );
}

