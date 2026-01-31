import { createClient } from "redis";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: ".env.development" });

const REDIS_URL = process.env.REDIS_URL;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

async function testRedis() {
    console.log("=".repeat(60));
    console.log("Redis 连接测试");
    console.log("=".repeat(60));
    console.log();

    // 检查环境变量
    console.log("📋 环境变量检查:");
    console.log(`  REDIS_URL: ${REDIS_URL ? "✓ 已设置" : "✗ 未设置"}`);
    if (REDIS_URL) {
        // 隐藏密码部分
        const urlDisplay = REDIS_URL.replace(/:[^:@]+@/, ":****@");
        console.log(`    值: ${urlDisplay}`);
    }
    console.log(`  REDIS_PASSWORD: ${REDIS_PASSWORD ? "✓ 已设置" : "✗ 未设置"}`);
    console.log();

    if (!REDIS_URL) {
        console.error("❌ 错误: REDIS_URL 环境变量未设置");
        console.log("\n提示: 请在 .env.development 文件中设置 REDIS_URL");
        process.exit(1);
    }

    // 创建 Redis 客户端
    console.log("🔌 创建 Redis 客户端...");
    const client = createClient({
        url: REDIS_URL,
        password: REDIS_PASSWORD,
    });

    // 设置错误处理
    client.on("error", (err) => {
        console.error("❌ [Redis] 错误:", err);
    });

    client.on("connect", () => {
        console.log("✓ 客户端已连接");
    });

    client.on("ready", () => {
        console.log("✓ 客户端已就绪");
    });

    client.on("reconnecting", () => {
        console.log("🔄 正在重连...");
    });

    try {
        // 测试连接
        console.log("\n📡 测试连接...");
        const connectStart = Date.now();
        await client.connect();
        const connectTime = Date.now() - connectStart;
        console.log(`✓ 连接成功 (耗时: ${connectTime}ms)`);

        // 测试 PING
        console.log("\n🏓 测试 PING...");
        const pingStart = Date.now();
        const pingResult = await client.ping();
        const pingTime = Date.now() - pingStart;
        console.log(`✓ PING 响应: ${pingResult} (耗时: ${pingTime}ms)`);

        // 测试 SET/GET
        console.log("\n💾 测试 SET/GET...");
        const testKey = "test:coachlink:connection";
        const testValue = `test-${Date.now()}`;

        const setStart = Date.now();
        await client.set(testKey, testValue, { EX: 60 }); // 60秒过期
        const setTime = Date.now() - setStart;
        console.log(`✓ SET 成功 (耗时: ${setTime}ms)`);

        const getStart = Date.now();
        const retrievedValue = await client.get(testKey);
        const getTime = Date.now() - getStart;
        console.log(`✓ GET 成功 (耗时: ${getTime}ms)`);
        console.log(`  键: ${testKey}`);
        console.log(`  值: ${retrievedValue}`);
        console.log(`  匹配: ${retrievedValue === testValue ? "✓" : "✗"}`);

        // 测试 EXISTS
        console.log("\n🔍 测试 EXISTS...");
        const existsStart = Date.now();
        const exists = await client.exists(testKey);
        const existsTime = Date.now() - existsStart;
        console.log(`✓ EXISTS 成功 (耗时: ${existsTime}ms)`);
        console.log(`  键存在: ${exists === 1 ? "✓" : "✗"}`);

        // 测试 TTL
        console.log("\n⏱️  测试 TTL...");
        const ttlStart = Date.now();
        const ttl = await client.ttl(testKey);
        const ttlTime = Date.now() - ttlStart;
        console.log(`✓ TTL 成功 (耗时: ${ttlTime}ms)`);
        console.log(`  剩余过期时间: ${ttl} 秒`);

        // 测试 DEL
        console.log("\n🗑️  测试 DEL...");
        const delStart = Date.now();
        const deleted = await client.del(testKey);
        const delTime = Date.now() - delStart;
        console.log(`✓ DEL 成功 (耗时: ${delTime}ms)`);
        console.log(`  删除的键数: ${deleted}`);

        // 测试 INFO
        console.log("\n📊 获取服务器信息...");
        const infoStart = Date.now();
        const infoResult: any = await client.info("server");
        const infoTime = Date.now() - infoStart;
        console.log(`✓ INFO 成功 (耗时: ${infoTime}ms)`);
        
        // 解析并显示关键信息
        const infoStr = String(infoResult);
        const infoLines = infoStr.split("\r\n");
        const keyInfo: Record<string, string> = {};
        infoLines.forEach(line => {
            if (line && !line.startsWith("#")) {
                const [key, value] = line.split(":");
                if (key && value) {
                    keyInfo[key] = value;
                }
            }
        });
        
        if (keyInfo["redis_version"]) {
            console.log(`  Redis 版本: ${keyInfo["redis_version"]}`);
        }
        if (keyInfo["os"]) {
            console.log(`  操作系统: ${keyInfo["os"]}`);
        }
        if (keyInfo["used_memory_human"]) {
            console.log(`  已用内存: ${keyInfo["used_memory_human"]}`);
        }
        if (keyInfo["connected_clients"]) {
            console.log(`  连接客户端数: ${keyInfo["connected_clients"]}`);
        }

        // 测试验证码存储（模拟实际使用场景）
        console.log("\n📝 测试验证码存储场景...");
        const codeKey = "test:verification_code:test@example.com";
        const codeValue = "123456";
        
        const codeSetStart = Date.now();
        await client.set(codeKey, codeValue, { EX: 300 }); // 5分钟过期
        const codeSetTime = Date.now() - codeSetStart;
        console.log(`✓ 验证码存储成功 (耗时: ${codeSetTime}ms)`);

        const codeGetStart = Date.now();
        const retrievedCode = await client.get(codeKey);
        const codeGetTime = Date.now() - codeGetStart;
        console.log(`✓ 验证码读取成功 (耗时: ${codeGetTime}ms)`);
        console.log(`  验证码: ${retrievedCode}`);

        // 清理测试数据
        await client.del(codeKey);
        console.log("✓ 测试数据已清理");

        // 汇总
        console.log("\n" + "=".repeat(60));
        console.log("✅ 所有测试通过!");
        console.log("=".repeat(60));
        console.log("\n性能汇总:");
        console.log(`  连接耗时: ${connectTime}ms`);
        console.log(`  PING 耗时: ${pingTime}ms`);
        console.log(`  SET 耗时: ${setTime}ms`);
        console.log(`  GET 耗时: ${getTime}ms`);
        console.log(`  EXISTS 耗时: ${existsTime}ms`);
        console.log(`  TTL 耗时: ${ttlTime}ms`);
        console.log(`  DEL 耗时: ${delTime}ms`);
        console.log(`  INFO 耗时: ${infoTime}ms`);

    } catch (error: any) {
        console.error("\n❌ 测试失败:");
        console.error("错误类型:", error?.constructor?.name || "Unknown");
        console.error("错误消息:", error?.message || error);
        console.error("错误代码:", error?.code || "N/A");
        
        if (error?.code === "ECONNREFUSED") {
            console.error("\n💡 提示:");
            console.error("  连接被拒绝，请检查:");
            console.error("  1. Redis 服务器是否正在运行");
            console.error("  2. REDIS_URL 是否正确");
            console.error("  3. 防火墙是否允许连接");
            console.error("  4. 网络是否可达");
        } else if (error?.code === "ENOTFOUND") {
            console.error("\n💡 提示:");
            console.error("  无法解析主机名，请检查 REDIS_URL 中的主机地址");
        } else if (error?.message?.includes("password")) {
            console.error("\n💡 提示:");
            console.error("  密码验证失败，请检查 REDIS_PASSWORD 是否正确");
        }

        process.exit(1);
    } finally {
        // 关闭连接
        console.log("\n🔌 关闭连接...");
        try {
            await client.quit();
            console.log("✓ 连接已关闭");
        } catch (error: any) {
            console.error("⚠️  关闭连接时出错:", error?.message || error);
        }
    }
}

// 运行测试
testRedis().catch((error) => {
    console.error("未捕获的错误:", error);
    process.exit(1);
});
