/**
 * 清理 videos bucket 中的孤儿文件
 *
 * 这个脚本会：
 * 1. 列出 videos bucket 中的所有文件
 * 2. 查询数据库中所有有效的 storage_path
 * 3. 删除不在数据库中的文件
 *
 * 使用方法：npx tsx scripts/cleanup-orphan-videos.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
        "❌ 缺少环境变量 NEXT_SUPABASE_URL 或 NEXT_SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function listAllFilesInBucket(
    bucket: string,
    folder: string = "",
): Promise<string[]> {
    const allFiles: string[] = [];

    const { data: items, error } = await supabase.storage.from(bucket).list(
        folder,
        {
            limit: 1000,
        },
    );

    if (error) {
        console.error(`❌ 列出 ${bucket}/${folder} 失败:`, error);
        return [];
    }

    for (const item of items || []) {
        const path = folder ? `${folder}/${item.name}` : item.name;

        if (item.id === null) {
            // 这是一个文件夹，递归处理
            const subFiles = await listAllFilesInBucket(bucket, path);
            allFiles.push(...subFiles);
        } else {
            // 这是一个文件
            allFiles.push(path);
        }
    }

    return allFiles;
}

async function getValidVideoPathsFromDB(): Promise<Set<string>> {
    const { data, error } = await supabase
        .from("execution_set_videos")
        .select("storage_path");

    if (error) {
        console.error("❌ 查询数据库失败:", error);
        return new Set();
    }

    return new Set(data?.map((v) => v.storage_path).filter(Boolean) || []);
}

async function cleanupOrphanFiles(dryRun: boolean = true) {
    console.log("🔍 开始扫描 videos bucket...\n");

    // 1. 列出所有文件
    const allFiles = await listAllFilesInBucket("videos");
    console.log(`📁 videos bucket 中共有 ${allFiles.length} 个文件\n`);

    // 排除 payment-qrcodes 文件夹中的文件（这些需要迁移而不是删除）
    const videoFiles = allFiles.filter((f) =>
        !f.startsWith("payment-qrcodes/")
    );
    const qrcodeFiles = allFiles.filter((f) =>
        f.startsWith("payment-qrcodes/")
    );

    console.log(`   - 视频文件: ${videoFiles.length} 个`);
    console.log(
        `   - 收款码文件 (payment-qrcodes/): ${qrcodeFiles.length} 个\n`,
    );

    if (qrcodeFiles.length > 0) {
        console.log("⚠️  发现以下收款码文件在 videos bucket 中:");
        qrcodeFiles.forEach((f) => console.log(`   - ${f}`));
        console.log("   这些文件需要手动迁移到 payment-qrcodes bucket\n");
    }

    // 2. 获取数据库中有效的 storage_path
    const validPaths = await getValidVideoPathsFromDB();
    console.log(`💾 数据库中有 ${validPaths.size} 个有效的视频记录\n`);

    // 3. 找出孤儿文件
    const orphanFiles = videoFiles.filter((f) => !validPaths.has(f));
    console.log(`🗑️  发现 ${orphanFiles.length} 个孤儿文件:\n`);

    if (orphanFiles.length === 0) {
        console.log("✅ 没有需要清理的孤儿文件！");
        return;
    }

    orphanFiles.forEach((f) => console.log(`   - ${f}`));

    if (dryRun) {
        console.log("\n⚠️  当前为 DRY RUN 模式，不会实际删除文件");
        console.log(
            "   如需实际删除，请使用: npx tsx scripts/cleanup-orphan-videos.ts --delete\n",
        );
    } else {
        console.log("\n🗑️  开始删除孤儿文件...\n");

        // 分批删除（每次最多删除 100 个）
        const batchSize = 100;
        for (let i = 0; i < orphanFiles.length; i += batchSize) {
            const batch = orphanFiles.slice(i, i + batchSize);
            const { error } = await supabase.storage.from("videos").remove(
                batch,
            );

            if (error) {
                console.error(`❌ 删除失败:`, error);
            } else {
                console.log(
                    `✅ 已删除 ${
                        Math.min(i + batchSize, orphanFiles.length)
                    }/${orphanFiles.length} 个文件`,
                );
            }
        }

        console.log("\n✅ 清理完成！");
    }
}

// 运行脚本
const args = process.argv.slice(2);
const dryRun = !args.includes("--delete");

cleanupOrphanFiles(dryRun);
