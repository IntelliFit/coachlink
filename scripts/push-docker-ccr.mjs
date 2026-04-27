#!/usr/bin/env node
/**
 * 在本机构建 Docker 镜像并推送到腾讯云 CCR（绕过 GitHub Actions 跨境推送过慢）。
 *
 * 镜像路径固定为：ccr.ccs.tencentyun.com/coachlink/coachlink（与当前项目 CCR 命名一致）。
 * 运行时配置由部署侧 .env 注入，构建阶段不要求 NEXT_PUBLIC_*。
 *
 * 用法（在仓库根目录）：
 *   npm run push-docker-ccr
 *
 * 分支与标签：
 *   main → :latest、:main、:<7位 sha>
 *   dev  → :dev、:<7位 sha>
 *   其它分支 → 提示切换到 main 或 dev
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/** 个人版 CCR 默认域名；镜像命名空间与仓库名均为 coachlink */
const REGISTRY = 'ccr.ccs.tencentyun.com';
const IMAGE_NAMESPACE = 'coachlink';
const IMAGE_REPOSITORY = 'coachlink';

function print(...args) {
  console.log(...args);
}

function die(msg, hint) {
  console.error(`\n错误: ${msg}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

function run(name, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: opts.inherit === false ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: opts.shell ?? false,
    env: { ...process.env, ...opts.env },
  });
  if (r.status !== 0) {
    const err = (r.stderr || '').trim();
    const out = (r.stdout || '').trim();
    return {
      ok: false,
      code: r.status,
      signal: r.signal,
      stderr: err,
      stdout: out,
    };
  }
  return { ok: true, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function hasDocker() {
  const r = run('docker version', 'docker', ['version'], { inherit: false });
  if (!r.ok) {
    return {
      ok: false,
      hint:
        '未检测到可用的 Docker。\n' +
        '  • Windows / macOS：请安装并启动 Docker Desktop（托盘图标就绪后再试）。\n' +
        '  • Linux：请安装 docker.io 或 Docker Engine，并确保当前用户在 docker 组或使用 sudo。\n' +
        '  安装后在本终端执行 `docker version` 应能同时看到 Client 与 Server。',
    };
  }
  return { ok: true };
}

function git(args, inherit = false) {
  return run(`git ${args.join(' ')}`, 'git', args, { inherit });
}

function main() {
  print('=== CoachLink：本地构建并推送腾讯云 CCR ===\n');

  const dockerCheck = hasDocker();
  if (!dockerCheck.ok) {
    die('无法执行 docker', dockerCheck.hint);
  }

  if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    die('当前目录不是 Git 仓库根目录', '请在 coachlink 仓库根目录执行：npm run push-docker-ccr');
  }

  const br = git(['rev-parse', '--abbrev-ref', 'HEAD'], false);
  if (!br.ok) {
    die('无法读取当前 Git 分支', '请确认已安装 git 且在本仓库内执行。');
  }
  const branch = (br.stdout || '').trim();
  const shaR = git(['rev-parse', '--short=7', 'HEAD'], false);
  const shortSha = shaR.ok ? (shaR.stdout || '').trim() : 'unknown';

  if (branch !== 'main' && branch !== 'dev') {
    die(
      `当前分支为「${branch}」，本脚本只支持在 main 或 dev 上打对应标签。`,
      '请执行：\n' +
        '  git checkout main   # 要打 latest + main + sha\n' +
        '  或\n' +
        '  git checkout dev    # 要打 dev + sha\n' +
        '然后再运行：npm run push-docker-ccr',
    );
  }

  const imageBase = `${REGISTRY}/${IMAGE_NAMESPACE}/${IMAGE_REPOSITORY}`;
  const tags =
    branch === 'main'
      ? [`${imageBase}:latest`, `${imageBase}:main`, `${imageBase}:${shortSha}`]
      : [`${imageBase}:dev`, `${imageBase}:${shortSha}`];

  print(`Registry:   ${REGISTRY}`);
  print(`镜像基名:   ${imageBase}（命名空间/仓库名已写死为 coachlink/coachlink）`);
  print(`当前分支:   ${branch}`);
  print(`Git 短 SHA: ${shortSha}`);
  print(`将打标签:   ${tags.join(', ')}\n`);

  print('--- 登录（推送前须已登录腾讯云 CCR）---');
  print('若尚未登录，请先在本机执行（用户名一般为腾讯云账号 ID）：');
  print(`  docker login ${REGISTRY}`);
  print('然后再运行本脚本。\n');

  const buildArgs = ['build'];
  for (const t of tags) {
    buildArgs.push('-t', t);
  }
  buildArgs.push('.');

  print('--- docker build ---');
  const build = run('docker build', 'docker', buildArgs, { inherit: true });
  if (!build.ok) {
    die('docker build 失败', '请根据上方日志排查 Dockerfile。');
  }

  print('\n--- docker push ---');
  for (const t of tags) {
    print(`\n推送: ${t}`);
    const p = run(`docker push ${t}`, 'docker', ['push', t], { inherit: true });
    if (!p.ok) {
      die(
        `推送失败: ${t}`,
        '常见原因：未登录腾讯云 CCR、账号或密码错误、网络问题。\n' +
          `请先执行: docker login ${REGISTRY}\n` +
          '用户名一般为腾讯云账号 ID；密码为容器镜像服务控制台为实例设置的登录密码。\n' +
          '若已登录仍失败，请查看上方 docker 原始报错。',
      );
    }
  }

  print('\n全部推送完成。');
  print(`示例拉取: docker pull ${tags[0]}`);
}

main();
