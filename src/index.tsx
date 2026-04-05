#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./app.js";

function printUsage(): void {
  const usage = `
meldr-dash — Claude Code dashboard

Usage:
  meldr-dash [options]

Options:
  --cli <name>       Adapter name (default: "claude", only "claude" supported)
  --poll <seconds>   Poll interval in seconds (default: 15)
  --data-dir <path>  Custom data directory (default: ~/.claude)
  --session <id>     Specific session ID to monitor
  --help             Show this help message

Keybindings:
  q  Quit
  r  Force refresh
  n  Next recommendations page
  p  Previous recommendations page
`.trim();

  console.log(usage);
}

function parseArgs(argv: string[]): {
  cli: string;
  poll: number;
  dataDir?: string;
  sessionId?: string;
  help: boolean;
} {
  const args = argv.slice(2);
  let cli = "claude";
  let poll = 15;
  let dataDir: string | undefined;
  let sessionId: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--cli":
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
      case "--help":
      case "-h":
        help = true;
        break;
    }
  }

  return { cli, poll, dataDir, sessionId, help };
}

const opts = parseArgs(process.argv);

if (opts.help) {
  printUsage();
  process.exit(0);
}

if (opts.cli !== "claude") {
  console.error(`Unsupported adapter: "${opts.cli}". Only "claude" is supported.`);
  process.exit(1);
}

render(
  <App
    dataDir={opts.dataDir}
    sessionId={opts.sessionId}
    pollInterval={opts.poll * 1000}
  />,
);
