import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const BOOTSTRAP_ENV_FILE = ".env";
const NEXT_ENV_PROCESSED_FLAG = "__NEXT_PROCESSED_ENV";

export async function bootstrapEnv(options = {}) {
    const mode = normalizeMode(options.mode || process.env.NODE_ENV || "development");
    const root = options.projectRoot || projectRoot;
    const bootstrap = readEnvFile(path.join(root, BOOTSTRAP_ENV_FILE), { required: true });
    const source = normalizeConfigSource(bootstrap.CONFIG_SOURCE);

    if (!source) {
        throw new Error(`${BOOTSTRAP_ENV_FILE} must set CONFIG_SOURCE=local or CONFIG_SOURCE=apollo`);
    }

    applyEnv(bootstrap, { override: true });

    if (source === "local") {
        const localEnvFile = bootstrap.LOCAL_ENV_FILE || defaultLocalEnvFile(mode);
        const localEnv = readEnvFile(path.join(root, localEnvFile), { required: true });
        applyEnv(localEnv, { override: true });
        markNextEnvProcessed();
        return {
            source,
            mode,
            loadedFiles: [BOOTSTRAP_ENV_FILE, localEnvFile],
            loadedKeys: Object.keys(localEnv).sort(),
        };
    }

    if (source === "apollo") {
        const apolloEnv = await loadApolloEnv(bootstrap);
        applyEnv(apolloEnv, { override: true });
        markNextEnvProcessed();
        return {
            source,
            mode,
            loadedFiles: [BOOTSTRAP_ENV_FILE],
            loadedKeys: Object.keys(apolloEnv).sort(),
            apollo: {
                appId: bootstrap.APOLLO_APP_ID,
                cluster: bootstrap.APOLLO_CLUSTER || "default",
                namespaces: parseList(bootstrap.APOLLO_NAMESPACES || "application"),
            },
        };
    }

    throw new Error(`CONFIG_SOURCE must be local or apollo, got ${JSON.stringify(source)}`);
}

export function nextEnvForChild(extra = {}) {
    return {
        ...process.env,
        ...extra,
        [NEXT_ENV_PROCESSED_FLAG]: "true",
    };
}

function normalizeMode(mode) {
    return String(mode || "").trim() === "production" ? "production" : "development";
}

function normalizeConfigSource(source) {
    const normalized = String(source || "").trim().toLowerCase();
    if (normalized === "local" || normalized === "apollo") {
        return normalized;
    }
    return "";
}

function defaultLocalEnvFile(mode) {
    return mode === "production" ? ".env.production" : ".env.development";
}

function readEnvFile(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
        if (options.required) {
            throw new Error(`${path.basename(filePath)} must exist`);
        }
        return {};
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return dotenv.parse(raw);
}

function applyEnv(values, options = {}) {
    const override = options.override === true;
    for (const [key, value] of Object.entries(values)) {
        if (!override && process.env[key] !== undefined) {
            continue;
        }
        process.env[key] = String(value);
    }
}

function markNextEnvProcessed() {
    process.env[NEXT_ENV_PROCESSED_FLAG] = "true";
}

async function loadApolloEnv(bootstrap) {
    const configServerUrl = required(bootstrap, "APOLLO_CONFIG_SERVER_URL").replace(/\/+$/, "");
    const appId = required(bootstrap, "APOLLO_APP_ID");
    const cluster = bootstrap.APOLLO_CLUSTER || "default";
    const namespaces = parseList(bootstrap.APOLLO_NAMESPACES || "application");
    if (configServerUrl.includes("example.com")) {
        throw new Error("APOLLO_CONFIG_SERVER_URL is still the example value; set it to the real Apollo config service URL");
    }
    if (namespaces.length === 0) {
        throw new Error("APOLLO_NAMESPACES must contain at least one namespace");
    }
    for (const namespace of namespaces) {
        if (/^https?:\/\//i.test(namespace)) {
            throw new Error(`APOLLO_NAMESPACES must contain namespace names, not URLs; got ${JSON.stringify(namespace)}`);
        }
    }

    const out = {};
    for (const namespace of namespaces) {
        const content = await fetchApolloNamespace({
            configServerUrl,
            appId,
            cluster,
            namespace,
            accessKeySecret: bootstrap.APOLLO_ACCESS_KEY_SECRET || "",
            label: bootstrap.APOLLO_LABEL || "",
        });
        Object.assign(out, parseApolloContent(namespace, content));
    }

    if (Object.keys(out).length === 0) {
        throw new Error(
            `Apollo returned no usable config: app_id=${appId} cluster=${cluster} namespaces=${namespaces.join(",")}`,
        );
    }
    return out;
}

function required(values, key) {
    const value = String(values[key] || "").trim();
    if (!value) {
        throw new Error(`${key} must be set in ${BOOTSTRAP_ENV_FILE} when CONFIG_SOURCE=apollo`);
    }
    return value;
}

function parseList(value) {
    return String(value || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

async function fetchApolloNamespace(options) {
    const rawUrl = buildApolloRawConfigUrl(options);
    const headers = apolloAuthHeaders(rawUrl, options.appId, options.accessKeySecret);
    let rawResp;
    try {
        rawResp = await fetch(rawUrl, { headers });
    } catch (error) {
        throw new Error(`fetch Apollo namespace ${options.namespace} failed at ${rawUrl}: ${error.message}`);
    }
    if (rawResp.ok) {
        return decodeApolloRawConfigBody(await rawResp.text());
    }

    const jsonUrl = buildApolloJsonConfigUrl(options);
    let jsonResp;
    try {
        jsonResp = await fetch(jsonUrl, {
            headers: apolloAuthHeaders(jsonUrl, options.appId, options.accessKeySecret),
        });
    } catch (error) {
        throw new Error(`fetch Apollo namespace ${options.namespace} failed at ${jsonUrl}: ${error.message}`);
    }
    const body = await jsonResp.text();
    if (!jsonResp.ok) {
        throw new Error(
            `fetch Apollo namespace ${options.namespace} failed: raw_status=${rawResp.status} json_status=${jsonResp.status} body=${body.trim()}`,
        );
    }
    return body;
}

function buildApolloRawConfigUrl(options) {
    const url = new URL(
        `configfiles/${encodeURIComponent(options.appId)}/${encodeURIComponent(options.cluster)}/${encodeURIComponent(options.namespace)}`,
        `${options.configServerUrl}/`,
    );
    url.searchParams.set("ip", "127.0.0.1");
    if (options.label) {
        url.searchParams.set("label", options.label);
    }
    return url.toString();
}

function buildApolloJsonConfigUrl(options) {
    const url = new URL(
        `configs/${encodeURIComponent(options.appId)}/${encodeURIComponent(options.cluster)}/${encodeURIComponent(options.namespace)}`,
        `${options.configServerUrl}/`,
    );
    url.searchParams.set("ip", "127.0.0.1");
    if (options.label) {
        url.searchParams.set("label", options.label);
    }
    return url.toString();
}

function apolloAuthHeaders(requestUrl, appId, secret) {
    if (!secret) {
        return {};
    }
    const timestamp = String(Date.now());
    const parsed = new URL(requestUrl);
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;
    const signature = crypto
        .createHmac("sha1", secret)
        .update(`${timestamp}\n${pathWithQuery}`)
        .digest("base64");
    return {
        Authorization: `Apollo ${appId}:${signature}`,
        Timestamp: timestamp,
    };
}

function decodeApolloRawConfigBody(body) {
    let content = String(body || "").trim();
    if (content.startsWith("content=")) {
        content = unescapeJavaPropertiesValue(content.slice("content=".length));
    }
    return content.trim();
}

function parseApolloContent(namespace, content) {
    const trimmed = String(content || "").trim();
    if (!trimmed) {
        return {};
    }

    if (looksLikeJson(trimmed)) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.configurations) {
            return stringifyValues(parsed.configurations);
        }
        return stringifyValues(parsed);
    }

    const env = dotenv.parse(trimmed);
    if (Object.keys(env).length > 0) {
        return unescapeEnvValues(env);
    }

    throw new Error(`Apollo namespace ${namespace} is not valid .env/properties or JSON content`);
}

function unescapeEnvValues(values) {
    const out = {};
    for (const [key, value] of Object.entries(values)) {
        out[key] = unescapeJavaPropertiesValue(String(value));
    }
    return out;
}

function looksLikeJson(content) {
    return content.startsWith("{") && content.endsWith("}");
}

function stringifyValues(values) {
    const out = {};
    for (const [key, value] of Object.entries(values || {})) {
        if (value == null) {
            continue;
        }
        out[key] = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    return out;
}

function unescapeJavaPropertiesValue(value) {
    let out = "";
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (ch !== "\\" || i === value.length - 1) {
            out += ch;
            continue;
        }
        i += 1;
        switch (value[i]) {
            case "n":
                out += "\n";
                break;
            case "r":
                out += "\r";
                break;
            case "t":
                out += "\t";
                break;
            case "f":
                out += "\f";
                break;
            default:
                out += value[i];
                break;
        }
    }
    return out;
}
