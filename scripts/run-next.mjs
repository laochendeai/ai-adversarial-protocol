#!/usr/bin/env node

import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const [mode = "dev", ...extraArgs] = process.argv.slice(2);
const preferredPort = parsePort(process.env.PORT, 5892);
const portSearchLimit = parsePort(process.env.PORT_SEARCH_LIMIT, 20);

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

if (!["dev", "start"].includes(mode)) {
  console.error(`Unsupported mode: ${mode}`);
  process.exit(1);
}

const port = await findAvailablePort(preferredPort, portSearchLimit);
if (port !== preferredPort) {
  console.log(`Port ${preferredPort} is in use, switched to ${port}.`);
}

console.log(`Starting Next.js on http://localhost:${port}`);

const child = spawn(process.execPath, [nextBin, mode, "-p", String(port), ...extraArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

async function findAvailablePort(startPort, maxAttempts) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  console.error(
    `Could not find an available port in range ${startPort}-${startPort + maxAttempts - 1}.`,
  );
  process.exit(1);
}

function canListen(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      server.close(() => {
        if (error.code === "EADDRINUSE" || error.code === "EACCES") {
          resolve(false);
          return;
        }
        reject(error);
      });
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

function parsePort(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
