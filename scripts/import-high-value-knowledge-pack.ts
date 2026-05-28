import path from "node:path";
import dotenv from "dotenv";

type Flags = {
    dryRun: boolean;
    publish: boolean;
    adminUserId?: string;
};

function parseFlags(argv: string[]): Flags {
    const flags: Flags = { dryRun: false, publish: true };
    for (const arg of argv) {
        if (arg === "--dry-run") flags.dryRun = true;
        if (arg === "--draft") flags.publish = false;
        if (arg.startsWith("--admin-user-id=")) {
            flags.adminUserId = arg.slice("--admin-user-id=".length).trim();
        }
    }
    return flags;
}

async function resolveAdminUserId(explicitUserId?: string) {
    if (explicitUserId) return explicitUserId;

    const { serviceRoleSupabase } = await import("../src/lib/supabaseClient");
    const { data, error } = await (serviceRoleSupabase as any)
        .from("users")
        .select("id,is_admin")
        .eq("is_admin", true)
        .limit(1);

    if (error) {
        throw new Error(`读取管理员用户失败: ${error.message}`);
    }

    const adminUserId = data?.[0]?.id;
    if (!adminUserId) {
        throw new Error("没有找到 is_admin=true 的管理员用户，请用 --admin-user-id=<uuid> 指定导入归属。");
    }

    return adminUserId;
}

async function main() {
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
    dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

    const flags = parseFlags(process.argv.slice(2));
    const adminUserId = await resolveAdminUserId(flags.adminUserId);
    const { HIGH_VALUE_CONTENT_IMPORT_BUNDLE } = await import("../src/content/adminImport/highValueKnowledgePack");
    const { importAdminContentBundle } = await import("../src/lib/adminContentImport");

    const result = await importAdminContentBundle(HIGH_VALUE_CONTENT_IMPORT_BUNDLE, {
        adminUserId,
        publish: flags.publish,
        dryRun: flags.dryRun,
    });

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
