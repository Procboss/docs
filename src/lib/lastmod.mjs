import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * lastmod.mjs — the one place "when was this docs page last touched" lives.
 *
 * Priority per file: the git commit that last changed it (author date,
 * ISO-8601) → the filesystem mtime (git-less environments) → now.
 *
 * Shared by astro.config.mjs (sitemap <lastmod>) and DocLayout.astro
 * (article:modified_time + JSON-LD dateModified) so the two can never drift.
 * Plain .mjs on purpose: astro.config.mjs (Node) and Astro components
 * (Vite/Bun) must both be able to import it with zero toolchain ceremony.
 *
 * The map is memoized per process — one git pass for all ~30 files, however
 * many pages render or sitemap entries serialize.
 */

/**
 * The docs collection dir. NOTE: Astro BUNDLES this module into dist/chunks/
 * when DocLayout imports it, so import.meta.url points at the chunk, not the
 * source — process.cwd() (the project root, from where astro build/dev/test
 * always run) is the primary resolution, with the source-relative path as
 * the fallback for exotic working directories.
 */
function docsDir() {
  const candidates = [
    join(process.cwd(), "src", "content", "docs"),
    join(dirname(fileURLToPath(import.meta.url)), "..", "content", "docs"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

let cached = null;

/** Recursively collect .md files under the docs collection, as collection ids
 *  ("cli/daemon") — the same key [...slug].astro routes by. */
function collectionIds(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectionIds(full, `${prefix}${entry}/`));
    else if (entry.endsWith(".md")) out.push(`${prefix}${entry.replace(/\.md$/, "")}`);
  }
  return out;
}

/** ISO timestamp of the last commit that touched a file (git-less → null). */
function gitDate(file) {
  try {
    return execSync(`git log -1 --format=%cI -- ${JSON.stringify(file)}`, {
      cwd: dirname(file),
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    })
      .toString()
      .trim() || null;
  } catch {
    return null;
  }
}

/**
 * Map<collectionId, ISO-8601 date> — keyed "intro", "cli/daemon", ...
 * The intro entry is ALSO mirrored under "" (the site root "/") so sitemap
 * URL→slug mapping (which strips the origin and slashes) hits directly.
 */
export function getLastmodMap() {
  if (cached) return cached;
  cached = new Map();
  const dir = docsDir();
  for (const id of collectionIds(dir)) {
    const file = join(dir, `${id}.md`);
    let date = gitDate(file);
    if (!date) date = new Date(statSync(file).mtime).toISOString();
    cached.set(id, date);
    if (id === "intro") cached.set("", date);
  }
  return cached;
}

/** A conservative build-wide "content freshness" date (newest page). */
export function newestDocDate() {
  let newest = "1970-01-01T00:00:00.000Z";
  for (const [id, date] of getLastmodMap()) {
    if (id === "") continue;
    if (date > newest) newest = date;
  }
  return newest;
}

/** Frontmatter fields for a collection id (used by feed builders). */
export function frontmatterOf(id) {
  const file = join(docsDir(), `${id}.md`);
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].trim();
    }
  }
  return out;
}
