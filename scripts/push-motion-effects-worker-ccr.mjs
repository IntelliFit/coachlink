#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const registry = "ccr.ccs.tencentyun.com";
const imageBase = `${registry}/littlehorse/coachlink-motion-effects-worker`;

function run(command, args, inherit = true) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    shell: false,
  });
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || "").trim(),
  };
}

function fail(message) {
  console.error(`\n错误: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, ".git"))) fail("当前目录不是 Git 仓库");
if (!run("docker", ["version"], false).ok) fail("Docker 未启动");

const branchResult = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], false);
const shaResult = run("git", ["rev-parse", "--short=7", "HEAD"], false);
if (!branchResult.ok || !shaResult.ok) fail("无法读取 Git 状态");
const branch = branchResult.stdout;
if (!["main", "dev"].includes(branch)) fail(`仅支持 main/dev，当前为 ${branch}`);

const tags = branch === "main"
  ? [`${imageBase}:latest`, `${imageBase}:main`, `${imageBase}:${shaResult.stdout}`]
  : [`${imageBase}:dev`, `${imageBase}:${shaResult.stdout}`];
const buildArgs = ["build", "-f", "Dockerfile.motion-effects-worker"];
for (const tag of tags) buildArgs.push("-t", tag);
buildArgs.push(".");

console.log(`构建 ${tags.join(", ")}`);
if (!run("docker", buildArgs).ok) fail("worker 镜像构建失败");
for (const tag of tags) {
  console.log(`推送 ${tag}`);
  if (!run("docker", ["push", tag]).ok) {
    fail(`推送失败，请确认已登录 ${registry}`);
  }
}
console.log("Motion Effects worker 镜像推送完成。");
