import { redirect } from "next/navigation";

// 兼容旧项目路由：/submit -> /data
export default function StreetliftingSubmitRedirectPage() {
    redirect("/streetlifting-index/data");
}

