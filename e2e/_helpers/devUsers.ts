import fs from "node:fs";
import path from "node:path";

export type DevUser = {
  name?: string;
  phone: string;
  password: string;
};

function parseUsers(raw: string | undefined): DevUser[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u) => u?.phone && u?.password);
  } catch {
    return [];
  }
}

function readEnvDevelopmentUsers(): DevUser[] {
  try {
    const envPath = path.resolve(process.cwd(), ".env.development");
    const content = fs.readFileSync(envPath, "utf-8");
    const line = content
      .split(/\r?\n/)
      .find((l) => l.trimStart().startsWith("NEXT_PUBLIC_DEV_USERS="));
    if (!line) return [];
    const raw = line.slice(line.indexOf("=") + 1).trim();
    return parseUsers(raw);
  } catch {
    return [];
  }
}

export function getDevUsers(): DevUser[] {
  const fromProcess = parseUsers(process.env.NEXT_PUBLIC_DEV_USERS);
  if (fromProcess.length > 0) return fromProcess;
  return readEnvDevelopmentUsers();
}

export function pickDevUserByKeyword(keyword: string): DevUser | null {
  const users = getDevUsers();
  const hit = users.find((u) => (u.name || "").includes(keyword));
  return hit || null;
}

