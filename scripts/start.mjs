import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../src/env.mjs";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(projectDirectory, ".env"));

const children = [];

function start(command, args, label) {
  const child = spawn(command, args, {
    cwd: projectDirectory,
    env: process.env,
    stdio: "inherit"
  });
  child.on("error", (error) => console.error(`${label} nao iniciou:`, error.message));
  children.push(child);
  return child;
}

const voiceEnabled = process.env.ALEX_TTS_AUTOSTART !== "false";
if (voiceEnabled) {
  const uvAvailable = spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;
  if (uvAvailable) {
    start(
      "uv",
      ["run", "--project", "voice", "--python", "3.12", "python", "voice/server.py"],
      "A voz neural"
    );
  } else {
    console.warn("uv nao encontrado; usando a voz masculina do sistema como reserva.");
  }
}

const application = start(process.execPath, ["src/server.mjs"], "O Alex");

function stop(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
application.on("exit", (code, signal) => {
  stop("SIGTERM");
  process.exitCode = code ?? (signal ? 1 : 0);
});
