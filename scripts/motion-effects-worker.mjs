#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapEnv, nextEnvForChild } from "./config/bootstrap-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const envBootstrap = await bootstrapEnv({
  mode: process.env.NODE_ENV || "production",
  projectRoot: repoRoot,
});
console.log(
  `[motion-effects-worker] config source=${envBootstrap.source} files=${envBootstrap.loadedFiles.join(",")}`,
);
const entry = process.argv.includes("--queue")
  ? "motion-effects-worker-cli.ts"
  : "motion-effects-worker.ts";
const child = spawn(
  process.execPath,
  [
    path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(repoRoot, "scripts", entry),
    ...process.argv.slice(2),
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: nextEnvForChild(),
  },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
child.on("error", (error) => {
  console.error("[motion-effects-worker] failed to start:", error);
  process.exit(1);
});
