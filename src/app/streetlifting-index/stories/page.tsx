"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, ExternalLink, FileText, Plus, Video } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Skeleton } from "primereact/skeleton";
import { Calendar } from "primereact/calendar";

import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";

import type { StreetliftingStory } from "@/app/api/streetlifting-index/stories/list/entity";
import type { StreetliftingCreateStoryDto } from "@/app/api/streetlifting-index/stories/create/entity";

export default function StreetliftingStoriesPage() {
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [stories, setStories] = useState<StreetliftingStory[]>([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [eventDate, setEventDate] = useState<Date | null>(null);
    const [form, setForm] = useState<StreetliftingCreateStoryDto>({
        title: "",
        content: "",
        video_url: "",
        type: "story",
        event_date: "",
        user_contact: "",
    });

    const fetchStories = async () => {
        setLoading(true);
        try {
            const data = await streetliftingIndexService.listStories();
            setStories(data?.stories || []);
        } catch (e: any) {
            console.error("[streetlifting-index][stories] list error:", e);
            showToast({ severity: "warn", summary: "提示", detail: "故事加载失败" });
            setStories([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetForm = () => {
        setEventDate(null);
        setForm({
            title: "",
            content: "",
            video_url: "",
            type: "story",
            event_date: "",
            user_contact: "",
        });
    };

    const formatDateYYYYMMDD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            if (!form.title?.trim()) throw new Error("请填写标题");

            await streetliftingIndexService.createStory({
                title: form.title.trim(),
                content: form.content?.trim() || null,
                video_url: form.video_url?.trim() || null,
                type: form.type || "story",
                event_date: eventDate ? formatDateYYYYMMDD(eventDate) : null,
                user_contact: form.user_contact?.trim() || null,
            });

            showToast({ severity: "success", summary: "提交成功", detail: "感谢你的分享" });
            setDialogOpen(false);
            resetForm();
            await fetchStories();
        } catch (e: any) {
            showToast({ severity: "warn", summary: "提交失败", detail: e?.message || "请稍后重试" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-xl font-bold tracking-tight text-surface-900">社区故事 / 事件</div>
                            <div className="text-sm text-surface-600 mt-1">
                                记录街健社区的故事、事件与里程碑（可附视频或文档链接）。
                            </div>
                        </div>
                        <Button
                            label="分享故事/事件"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setDialogOpen(true)}
                        />
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6">
                        {loading ? (
                            <div className="space-y-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <Skeleton width="55%" height="1rem" />
                                        <Skeleton width="90%" height="0.85rem" className="mt-2" />
                                    </div>
                                ))}
                            </div>
                        ) : stories.length === 0 ? (
                            <div className="text-center py-10 text-surface-500">
                                <div className="text-base font-semibold text-surface-900 mb-2">暂无故事</div>
                                <div className="text-sm">成为第一个分享者吧！</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {stories.map((s) => (
                                    <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                {s.type === "event" ? (
                                                    <CalendarIcon className="h-4 w-4 text-orange-600" />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-primary-600" />
                                                )}
                                                <div className="font-semibold text-surface-900">{s.title}</div>
                                            </div>
                                            {s.content && (
                                                <div className="mt-1 text-sm text-surface-600 ml-6">
                                                    {s.content}
                                                </div>
                                            )}
                                            {(s.event_date || s.created_at) && (
                                                <div className="mt-1 text-xs text-surface-400 ml-6">
                                                    {s.event_date ? `日期：${s.event_date}` : `发布：${new Date(s.created_at).toLocaleDateString("zh-CN")}`}
                                                </div>
                                            )}
                                        </div>

                                        {s.video_url && (
                                            <Button
                                                className="sm:w-auto w-full p-button-outlined"
                                                onClick={() => window.open(s.video_url || "", "_blank")}
                                            >
                                                <Video className="h-4 w-4 mr-2" />
                                                查看
                                                <ExternalLink className="h-4 w-4 ml-2" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <Dialog
                header="分享社区故事或事件"
                visible={dialogOpen}
                onHide={() => {
                    setDialogOpen(false);
                    resetForm();
                }}
                className="w-[95vw] md:w-[32rem]"
                draggable={false}
                style={{ maxHeight: "90vh" }}
            >
                <div className="space-y-4">
                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">标题 *</div>
                        <InputText
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            className="w-full"
                            placeholder="例如：xxx比赛冠军"
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">类型</div>
                        <Dropdown
                            value={form.type}
                            options={[
                                { label: "故事", value: "story" },
                                { label: "事件", value: "event" },
                            ]}
                            className="w-full"
                            onChange={(e) => setForm((p) => ({ ...p, type: e.value }))}
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">内容描述（可选）</div>
                        <InputTextarea
                            value={form.content || ""}
                            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                            className="w-full"
                            rows={4}
                            autoResize
                            placeholder="简要描述这个故事或事件…"
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">视频/文档链接（可选）</div>
                        <InputText
                            value={form.video_url || ""}
                            onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                            className="w-full"
                            placeholder="B站、抖音、公众号文章链接等"
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">事件日期（可选）</div>
                        <Calendar
                            value={eventDate}
                            onChange={(e) => setEventDate((e.value as Date) || null)}
                            dateFormat="yy-mm-dd"
                            showIcon
                            className="w-full"
                            placeholder="选择日期（可选）"
                        />
                    </div>

                    <div>
                        <div className="text-xs text-surface-500 mb-1.5">联系方式（可选）</div>
                        <InputText
                            value={form.user_contact || ""}
                            onChange={(e) => setForm((p) => ({ ...p, user_contact: e.target.value }))}
                            className="w-full"
                            placeholder="微信号或其他联系方式"
                        />
                    </div>

                    <Button
                        label={submitting ? "提交中..." : "提交"}
                        className="w-full"
                        onClick={handleSubmit}
                        loading={submitting}
                    />
                </div>
            </Dialog>
        </div>
    );
}

