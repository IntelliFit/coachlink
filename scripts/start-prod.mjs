import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapEnv, nextEnvForChild } from "./config/bootstrap-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const envBootstrap = await bootstrapEnv({ mode: "production", projectRoot });
console.log(`Loaded config source: ${envBootstrap.source}`);
console.log(`Loaded files: ${envBootstrap.loadedFiles.join(", ")}`);

const isWindows = os.platform() === "win32";
const standaloneServer = path.join(projectRoot, "server.js");
const command = fsExists(standaloneServer) ? "node" : "npx";
const args = fsExists(standaloneServer) ? ["server.js"] : ["next", "start"];
const child = spawn(
    isWindows ? "cmd.exe" : "sh",
    isWindows ? ["/c", command, ...args] : ["-c", `${command} ${args.join(" ")}`],
    {
        stdio: "inherit",
        env: nextEnvForChild({ NODE_ENV: "production" }),
        cwd: projectRoot,
    },
);

child.on("close", (code) => {
    process.exit(code ?? 0);
});

function fsExists(filePath) {
    return fs.existsSync(filePath);
}
