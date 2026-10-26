'use client';

import { Megaphone } from 'lucide-react';

export type AnnouncementCardData = {
    title: string;
    summary: string;
    content: string;
    coverImageUrl: string | null;
};

/** 弹窗和后台预览共用的公告卡片：封面大图 + 标题 + 摘要。 */
export default function AnnouncementCard({ data }: { data: AnnouncementCardData }) {
    const blurb = data.summary || data.content;
    return (
        <div className="overflow-hidden">
            {data.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={data.coverImageUrl}
                    alt=""
                    className="block max-h-[52vh] w-full bg-surface-100 object-cover"
                />
            ) : (
                <div className="flex h-36 items-center justify-center bg-primary-500">
                    <Megaphone className="h-16 w-16 text-white" strokeWidth={1.75} />
                </div>
            )}
            <div className="px-6 pb-2 pt-5">
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-600">
                    <Megaphone className="h-3.5 w-3.5" />
                    平台通知
                </div>
                <h2 className="text-xl font-black leading-snug text-surface-950">{data.title || '通知标题'}</h2>
                {blurb && (
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-surface-600">{blurb}</p>
                )}
            </div>
        </div>
    );
}
