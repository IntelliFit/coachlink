#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const venvDir = path.join(repoRoot, ".venv-power-analysis");
const pythonExe = path.join(venvDir, "Scripts", "python.exe");
const requirements = path.join(repoRoot, "scripts", "power-analysis", "requirements.txt");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(pythonExe)) {
  run("uv", ["venv", ".venv-power-analysis", "--python", "3.11"]);
}

run("uv", ["pip", "install", "--python", pythonExe, "-r", requirements]);
run(pythonExe, [
  "-c",
  "import mediapipe as mp; assert hasattr(mp, 'solutions'), f'mediapipe {mp.__version__} missing solutions API'; print(f'Power analysis Python ready: mediapipe {mp.__version__}')",
]);
