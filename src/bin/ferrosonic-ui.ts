import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getConfiguredSocketPath, socketExists } from "../lib/ferrosonic/daemon-ipc";
import { handlePlayerHttp } from "../lib/ferrosonic/player-http";

const DEFAULT_PORT = 4317;
const DEFAULT_HOSTNAME = "127.0.0.1";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function usage(): string {
  return `ferrosonic-ui — web control for ferrosonicd

Usage:
  ferrosonic-ui [--port PORT] [--hostname ADDR] [--no-daemon]

Defaults: --hostname ${DEFAULT_HOSTNAME} --port ${DEFAULT_PORT}

Starts the bundled ferrosonic player when its socket is not already open.
FERROSONIC_BIN overrides the bundled player. mpv is still required for audio.

Environment:
  FERROSONIC_SOCK           daemon socket path
  FERROSONIC_FORCE_DEMO=1   always use the in-process demo player
  FERROSONIC_FORCE_DAEMON=1 always use the Unix socket
`;
}

function readArg(argv: string[], flag: string, index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    console.error(`Missing value for ${flag}`);
    console.error(usage());
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]): { port: number; hostname: string; spawnDaemon: boolean } {
  let port = Number(process.env.FERROSONIC_UI_PORT ?? DEFAULT_PORT);
  let hostname = process.env.FERROSONIC_UI_HOST ?? DEFAULT_HOSTNAME;
  let spawnDaemon = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--no-daemon") {
      spawnDaemon = false;
      continue;
    }
    if (arg === "--port") {
      port = Number(readArg(argv, arg, i));
      i += 1;
      continue;
    }
    if (arg === "--hostname") {
      hostname = readArg(argv, arg, i);
      i += 1;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${port}`);
    process.exit(1);
  }
  return { port, hostname, spawnDaemon };
}

function findOnPath(): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "ferrosonic");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function bundledPlayer(): Promise<string | null> {
  const embedded = path.join(moduleDir(), "player", "ferrosonic");
  if (!existsSync(embedded)) return null;
  const dir = path.join(homedir(), ".local", "share", "ferrosonic-ui");
  const dest = path.join(dir, "ferrosonic");
  await mkdir(dir, { recursive: true });
  await writeFile(dest, await readFile(embedded));
  await chmod(dest, 0o755);
  return dest;
}

async function resolvePlayer(): Promise<string | null> {
  const fromEnv = process.env.FERROSONIC_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return (await bundledPlayer()) ?? findOnPath();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDaemon(enabled: boolean): Promise<void> {
  if (!enabled || process.env.FERROSONIC_FORCE_DEMO === "1") return;
  if (socketExists()) {
    console.log("ferrosonic daemon already running");
    return;
  }
  const bin = await resolvePlayer();
  if (!bin) {
    console.log("no ferrosonic player in this build; the page stays in demo mode");
    return;
  }
  const child = spawn(bin, ["--daemon"], { detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 50; i += 1) {
    if (socketExists()) {
      console.log(`started ${bin} --daemon`);
      return;
    }
    await sleep(100);
  }
  console.log("ferrosonic daemon did not open its socket; the page stays in demo mode");
}

function moduleDir(): string {
  const meta = import.meta as ImportMeta & { dir?: string };
  if (meta.dir) return meta.dir;
  return path.dirname(fileURLToPath(import.meta.url));
}

function uiRoot(): string {
  const embedded = path.join(moduleDir(), "out");
  if (existsSync(path.join(embedded, "index.html"))) return embedded;
  const exported = path.resolve("out");
  if (existsSync(path.join(exported, "index.html"))) return exported;
  console.error("UI assets not found. Rebuild with: npm run build:exe");
  process.exit(1);
}

function contentType(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function staticFile(root: string, urlPath: string): string | null {
  let rel = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  if (rel === "/") rel = "/index.html";
  const rootResolved = path.resolve(root);
  const candidates = [path.resolve(rootResolved, `.${rel}`)];
  if (!path.extname(rel)) {
    candidates.push(path.resolve(rootResolved, `.${rel}`, "index.html"));
  }
  for (const candidate of candidates) {
    if (candidate !== rootResolved && !candidate.startsWith(`${rootResolved}${path.sep}`)) {
      return null;
    }
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const { port, hostname, spawnDaemon } = parseArgs(process.argv.slice(2));
const root = uiRoot();
await ensureDaemon(spawnDaemon);

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const urlPath = req.url ?? "/";
  const pathname = urlPath.split("?")[0] ?? "/";

  try {
    if (pathname === "/api/player") {
      const raw = method === "POST" ? await readBody(req) : undefined;
      const result = await handlePlayerHttp(method, raw);
      const payload = JSON.stringify(result.body);
      res.writeHead(result.status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(method === "HEAD" ? undefined : payload);
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end();
      return;
    }

    const file = staticFile(root, pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end(method === "HEAD" ? undefined : "Not found");
      return;
    }

    const cache = file.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "content-type": contentType(file),
      "cache-control": cache,
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(await readFile(file));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(port, hostname, () => {
  console.log(`ferrosonic-ui http://${hostname}:${port}`);
  console.log(`daemon socket ${getConfiguredSocketPath()}`);
});
