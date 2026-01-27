// Onboarding (入驻流程) public page
import { Card } from "primereact/card";
import { notFound } from "next/navigation";
import MarkdownIt from "markdown-it";
import BackButton from "../../components/BackButton";
import { getDocContent } from "@/utils/content";

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

function buildLoginRedirect(targetPath: string) {
    return `/login?redirect=${encodeURIComponent(targetPath)}`;
}

export default async function OnboardingPage() {
    const content = await getDocContent("onboarding.md");
    if (!content) notFound();

    const htmlContent = md.render(content);

    const coachApplyRedirect = buildLoginRedirect("/coach/application?role=coach");
    const gymApplyRedirect = buildLoginRedirect("/coach/application?role=gym");

    return (
        <div className="min-h-screen bg-surface-50 py-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <BackButton />
                </div>

                <Card className="shadow-lg rounded-2xl border-none">
                    <div className="p-6 md:p-10">
                        <div
                            className="prose max-w-none text-surface-700"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />

                        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a
                                href={coachApplyRedirect}
                                className="h-12 rounded-2xl bg-primary-500 text-white font-black tracking-tight flex items-center justify-center hover:bg-primary-600 transition active:scale-[0.99]"
                            >
                                我是教练，立即入驻
                            </a>
                            <a
                                href={gymApplyRedirect}
                                className="h-12 rounded-2xl border border-surface-200 bg-surface text-surface-900 font-black tracking-tight flex items-center justify-center hover:border-primary-200 hover:bg-primary-50 transition active:scale-[0.99]"
                            >
                                我是健身房，申请合作
                            </a>
                        </div>

                        <div className="mt-4 text-xs text-surface-500 leading-relaxed">
                            提示：点击上方按钮后才会要求登录；登录成功会自动回到申请页面继续填写。
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

