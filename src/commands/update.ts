import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getLocalVersion(): string {
  const pkgPath = resolve(__dirname, "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export async function runUpdate(): Promise<void> {
  const localVersion = getLocalVersion();
  console.log(`Current version: v${localVersion}`);
  console.log("Checking for updates...");

  let latestVersion: string;
  try {
    const res = await fetch("https://registry.npmjs.org/meldr-dash/latest");
    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`);
    }
    const data = (await res.json()) as { version: string };
    latestVersion = data.version;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to check for updates: ${msg}`);
    process.exitCode = 1;
    return;
  }

  if (compareSemver(latestVersion, localVersion) <= 0) {
    console.log(`Already up to date (v${localVersion}).`);
    return;
  }

  console.log(`Updating meldr-dash v${localVersion} -> v${latestVersion}...`);

  try {
    // Command is hardcoded — no user input, no injection risk
    execSync("npm install -g meldr-dash@latest", { stdio: "inherit" });
    console.log(`Successfully updated to v${latestVersion}.`);
  } catch {
    console.error(
      "Update failed. If you see permission errors, try:\n" +
        "  sudo npm install -g meldr-dash@latest\n" +
        "Or configure npm to use a user-writable prefix:\n" +
        "  npm config set prefix ~/.npm-global",
    );
    process.exitCode = 1;
  }
}
