#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { App } from "./app.js";
import { ClaudeAdapter } from "./adapters/claude.js";
import { CursorAdapter } from "./adapters/cursor.js";
import { GeminiAdapter } from "./adapters/gemini.js";
import { CodexAdapter } from "./adapters/codex.js";
import { buildDumpOutput } from "./dump.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
  );
  return pkg.version;
}

// Subcommand interception — runs before parseArgs
const subcommand = process.argv[2];
if (subcommand === "update" || subcommand === "upgrade") {
  const { runUpdate } = await import("./commands/update.js");
  await runUpdate();
  process.exit(0);
}
if (subcommand === "--version" || subcommand === "-v") {
  console.log(`meldr-dash v${getVersion()}`);
  process.exit(0);
}

function printUsage(): void {
  const usage = `
meldr-dash — Claude Code dashboard

Usage:
  meldr-dash [command] [options]

Commands:
  update, upgrade    Update meldr-dash to the latest version

Options:
  --version, -v      Show version number
  --cli <name>       Adapter name (default: "claude")
  --platform <name>  Alias for --cli (e.g. "claude", "cursor", "gemini", "codex")
  --poll <seconds>   Poll interval in seconds (default: 15)
  --data-dir <path>  Custom data directory (default: ~/.claude)
  --session <id>     Specific session ID to monitor
  --dump <category>  Dump data as JSON to stdout and exit
                     Categories: state, sessions, monitors, tips,
                                 metrics, environment, all
  --help             Show this help message

Dump examples:
  meldr-dash --dump state
  meldr-dash --dump monitors --session <id>
  meldr-dash --dump all --platform cursor
  meldr-dash --dump sessions | jq '.[0].contextPercent'

Keybindings:
  q  Quit
  r  Force refresh
  p  Cycle platform
  s  Cycle active session
  ?  Toggle help
`.trim();

  console.log(usage);
}

function parseArgs(argv: string[]): {
  cli: string;
  poll: number;
  dataDir?: string;
  sessionId?: string;
  dump?: string;
  help: boolean;
} {
  const args = argv.slice(2);
  let cli = "claude";
  let poll = 15;
  let dataDir: string | undefined;
  let sessionId: string | undefined;
  let dump: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--cli":
      case "--platform":
        cli = args[++i] ?? "claude";
        break;
      case "--poll":
        poll = Number(args[++i]) || 15;
        break;
      case "--data-dir":
        dataDir = args[++i];
        break;
      case "--session":
        sessionId = args[++i];
        break;
      case "--dump":
        dump = args[++i];
        break;
      case "--help":
      case "-h":
        help = true;
        break;
    }
  }

  return { cli, poll, dataDir, sessionId, dump, help };
}

const opts = parseArgs(process.argv);

if (opts.help) {
  printUsage();
  process.exit(0);
}

function createAdapter(cli: string, dataDir?: string, sessionId?: string) {
  switch (cli) {
    case "cursor":
      return new CursorAdapter({ dataDir });
    case "gemini":
      return new GeminiAdapter({ dataDir });
    case "codex":
      return new CodexAdapter({ dataDir });
    default:
      return new ClaudeAdapter({ dataDir, sessionId });
  }
}

if (opts.dump) {
  const adapter = createAdapter(opts.cli, opts.dataDir, opts.sessionId);

  adapter
    .collectState()
    .then((state) => {
      const output = buildDumpOutput(opts.dump!, state, opts.sessionId);
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
} else {
  if (!["claude", "cursor", "gemini", "codex"].includes(opts.cli)) {
    console.error(
      `Unsupported adapter: "${opts.cli}". Supported: "claude", "cursor", "gemini", "codex".`,
    );
    process.exit(1);
  }

  render(
    <App
      dataDir={opts.dataDir}
      sessionId={opts.sessionId}
      pollInterval={opts.poll * 1000}
    />,
  );
}
