import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");
const stagingDir = path.join(root, ".pages-dist-staging");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(clientDir))) {
  console.error("[pages-dist] Expected dist/client after vite build — run `bun run build` first.");
  process.exit(1);
}

await fs.rm(stagingDir, { recursive: true, force: true });
await fs.rename(clientDir, stagingDir);
await fs.rm(serverDir, { recursive: true, force: true });
await fs.rm(distDir, { recursive: true, force: true });
await fs.rename(stagingDir, distDir);

const indexPath = path.join(distDir, "index.html");
if (!(await exists(indexPath))) {
  console.error("[pages-dist] dist/index.html missing after prepare step.");
  process.exit(1);
}

console.log("[pages-dist] Prepared Cloudflare Pages output in dist/");
