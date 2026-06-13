#!/usr/bin/env node
/**
 * 构建并推送 Power Analysis worker 镜像到腾讯云 CCR。
 *
 * 镜像路径：
 *   ccr.ccs.tencentyun.com/littlehorse/coachlink-power-worker
 *
 * 分支与标签：
 *   main → :latest、:main、:<7位 sha>
 *   dev  → :dev、:<7位 sha>
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REGISTRY = "ccr.ccs.tencentyun.com";
const IMAGE_NAMESPACE = "littlehorse";
const IMAGE_REPOSITORY = "coachlink-power-worker";

function die(message, hint) {
  console.error(`\n错误: ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    stdio: opts.inherit === false ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
    env: { ...process.env, ...opts.env },
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    code: result.status,
  };
}

function git(args) {
  return run("git", args, { inherit: false });
}

function main() {
  console.log("=== CoachLink：构建并推送 Power Analysis Worker 镜像 ===\n");

  if (!fs.existsSync(path.join(REPO_ROOT, ".git"))) {
    die("当前目录不是 Git 仓库根目录", "请在 coachlink 仓库根目录执行：npm run push-power-worker-ccr");
  }

  const docker = run("docker", ["version"], { inherit: false });
  if (!docker.ok) {
    die("无法执行 docker", "请先安装并启动 Docker Desktop / Docker Engine。");
  }

  const branchResult = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branchResult.ok) die("无法读取当前 Git 分支");
  const branch = branchResult.stdout;
  const shaResult = git(["rev-parse", "--short=7", "HEAD"]);
  const shortSha = shaResult.ok ? shaResult.stdout : "unknown";

  if (branch !== "main" && branch !== "dev") {
    die(
      `当前分支为「${branch}」，本脚本只支持 main 或 dev。`,
      "请切换到 main 或 dev 后再运行：npm run push-power-worker-ccr",
    );
  }

  const imageBase = `${REGISTRY}/${IMAGE_NAMESPACE}/${IMAGE_REPOSITORY}`;
  const tags =
    branch === "main"
      ? [`${imageBase}:latest`, `${imageBase}:main`, `${imageBase}:${shortSha}`]
      : [`${imageBase}:dev`, `${imageBase}:${shortSha}`];

  console.log(`Registry:   ${REGISTRY}`);
  console.log(`镜像基名:   ${imageBase}`);
  console.log(`当前分支:   ${branch}`);
  console.log(`Git 短 SHA: ${shortSha}`);
  console.log(`将打标签:   ${tags.join(", ")}\n`);
  console.log(`若尚未登录，请先执行：docker login ${REGISTRY}\n`);

  const buildArgs = ["build", "-f", "Dockerfile.power-worker"];
  for (const tag of tags) buildArgs.push("-t", tag);
  buildArgs.push(".");

  console.log("--- docker build worker ---");
  const build = run("docker", buildArgs);
  if (!build.ok) die("docker build 失败", "请根据上方日志排查 Dockerfile.power-worker。");

  console.log("\n--- docker push worker ---");
  for (const tag of tags) {
    console.log(`\n推送: ${tag}`);
    const push = run("docker", ["push", tag]);
    if (!push.ok) {
      die(`推送失败: ${tag}`, `请确认已登录腾讯云 CCR：docker login ${REGISTRY}`);
    }
  }

  console.log("\nWorker 镜像推送完成。");
  console.log(`示例拉取: docker pull ${tags[0]}`);
}

main();
