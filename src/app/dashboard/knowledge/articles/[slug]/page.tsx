// 旧的 markdown 文章详情已下线：知识库“文章”板块改为承载教练内容管理（coach_contents）发布的内容。
import { redirect } from "next/navigation";

export default function KnowledgeArticleLegacyRedirect({
    params,
}: {
    params: { slug: string };
}) {
    // 兼容：如果有人访问 `/dashboard/knowledge/articles/:id`，且 :id 看起来像内容 UUID，直接跳转到现有阅读页。
    const maybeId = params?.slug || "";
    const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            maybeId,
        );
    if (isUuid) redirect(`/coach/content/${maybeId}`);
    redirect("/dashboard/knowledge/articles");
}
