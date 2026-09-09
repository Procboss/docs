#!/usr/bin/env bun
/**
 * test-docs-consistency.ts — docs-vs-implementation consistency check.
 *
 * Owner rule: "For every update, write a test to confirm."
 * Guards the no-sudo documentation contract established when the boot
 * service became per-user (systemd --user unit / LaunchAgent / per-user
 * Scheduled Task, installers defaulting to ~/.local/bin and
 * %LOCALAPPDATA%\pboss):
 *
 *   1. The retired long "privileges/BUN_INSTALL" explainer paragraphs are
 *      gone (the noise the owner had removed).
 *   2. No sudo command appears in any docs page or pboss DOCS.md/README —
 *      the only tolerated mentions are negative statements ("no sudo",
 *      "sudo is rejected", "never required") and the snap channel, where
 *      refreshing is inherently sudo (snapd design, not pboss).
 *   3. The per-user facts ARE documented: user unit dir, systemctl --user,
 *      enable-linger, ~/.local/bin, %LOCALAPPDATA%\pboss.
 *   4. No stale system-service claims remain (/etc/systemd/system unit,
 *      multi-user.target, system-wide BUN_INSTALL flow).
 *   5. The pboss DOCS.md startup status example matches what the code
 *      actually prints (per-user header + Linger line).
 *
 * Run: bun scripts/test-docs-consistency.ts   (exit 0 = all checks pass)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const HERE = dirname(import.meta.path);
const DOCS_SITE = join(HERE, "..", "src", "content", "docs");
const PBOSS = join(HERE, "..", "..", "pboss");

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
  }
}

/** Recursively collect .md files under a directory. */
function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...mdFiles(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

const sitePages = mdFiles(DOCS_SITE);
const pbossDocs = [join(PBOSS, "DOCS.md"), join(PBOSS, "README.md")];

// ---------------------------------------------------------------------------
// 1. The removed explainer noise must stay removed (owner-quoted fragments).
// ---------------------------------------------------------------------------
const noiseFragments: Array<[string, string]> = [
  ["privileges essay", "Privileges: root (`sudo`) for the one-line installer"],
  ["install-bun sudo lead-in", "A **system-wide install** is recommended — `pboss startup install` needs sudo"],
  ["pipe-side sudo note", "Note that the sudo sits on the **bash** side of the pipe"],
  ["BUN_INSTALL two-jobs essay", "`BUN_INSTALL=/usr/local` appears on more than one command in this guide"],
  ["privilege-exit note", "If the installer is started without the required privileges, it exits immediately"],
  ["sudo-fallback note", "the fallback is a user-local install plus"],
];

for (const [name, fragment] of noiseFragments) {
  const hits = sitePages.filter((f) => readFileSync(f, "utf8").includes(fragment));
  ok(`noise removed: ${name}`, hits.length === 0, hits.length ? `still in ${hits.join(", ")}` : undefined);
}

// ---------------------------------------------------------------------------
// 2. No sudo COMMANDS anywhere. Precise rule: sudo is forbidden inside CODE
// contexts (fenced blocks + inline code spans) when used as a command
// prefix ("sudo <arg>"). Prose statements ("no sudo", "sudo is rejected",
// "never required") are not commands and are not flagged. The snap channel
// is tolerated: refreshing a snap is inherently sudo (snapd design).
// ---------------------------------------------------------------------------
function extractCode(text: string): string[] {
  const out: string[] = [];
  out.push(...(text.match(/```[\s\S]*?```/g) ?? [])); // fenced blocks
  out.push(...(text.match(/`[^`\n]+`/g) ?? [])); // inline code spans
  return out;
}

for (const file of [...sitePages, ...pbossDocs]) {
  const text = readFileSync(file, "utf8");
  const code = extractCode(text)
    .join("\n")
    // tolerated: the snap channel — snapd itself requires sudo to refresh
    .replace(/sudo snap refresh[^\n]*/g, "");
  const m = code.match(/\bsudo\s+\S/);
  ok(
    `no sudo commands: ${file.split("/").slice(-2).join("/")}`,
    m === null,
    m ? `sudo used as a command near ${JSON.stringify(code.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 60))}` : undefined,
  );
}

// ---------------------------------------------------------------------------
// 3. The per-user facts ARE present where they should be.
// ---------------------------------------------------------------------------
const installation = readFileSync(join(DOCS_SITE, "installation.md"), "utf8");
const startup = readFileSync(join(DOCS_SITE, "cli", "startup.md"), "utf8");
const quickstart = readFileSync(join(DOCS_SITE, "quickstart.md"), "utf8");

ok("installation: no-privileges requirement stated", /Privileges:\*\* none/.test(installation));
ok("installation: ~/.local/bin default", installation.includes("~/.local/bin"));
ok("installation: %LOCALAPPDATA%\\pboss default", installation.includes("%LOCALAPPDATA%\\pboss"));
ok("installation: bun add -g without sudo", /```bash\nbun add -g pboss\n```/.test(installation));
ok("installation: one-liner has no sudo", !/curl -fsSL https:\/\/procboss\.com\/install\.sh \| sudo/.test(installation));
ok("startup: per-user systemd unit path", startup.includes("~/.config/systemd/user/pboss.service"));
ok("startup: systemctl --user", startup.includes("systemctl --user"));
ok("startup: enable-linger documented", startup.includes("loginctl enable-linger"));
ok("startup: linger status line in example", startup.includes("Linger:     on — the daemon starts at BOOT, before login"));
ok("startup: status example is the per-user format", startup.includes("Boot startup service (systemd, per-user)"));
ok("startup: sudo rejected statement", /sudo` is rejected/.test(startup));
ok("quickstart: startup install without sudo", /```bash\npboss startup install\n```/.test(quickstart));

const combinedSite = sitePages.map((f) => readFileSync(f, "utf8")).join("\n");
for (const [name, fact] of [
  ["user unit dir", "~/.config/systemd/user"],
  ["systemctl --user", "systemctl --user"],
  ["enable-linger", "loginctl enable-linger"],
] as Array<[string, string]>) {
  ok(`site documents: ${name}`, combinedSite.includes(fact));
}

// ---------------------------------------------------------------------------
// 4. No stale system-service claims.
// ---------------------------------------------------------------------------
const staleClaims: Array<[string, string]> = [
  ["/etc/systemd/system/pboss.service", "/etc/systemd/system/pboss.service"],
  ["system-wide Bun flow", "sudo BUN_INSTALL=/usr/local"],
  ["multi-user.target", "multi-user.target"],
];
for (const [name, claim] of staleClaims) {
  const hits = [...sitePages, ...pbossDocs].filter((f) => readFileSync(f, "utf8").includes(claim));
  ok(`stale claim gone: ${name}`, hits.length === 0, hits.length ? `still in ${hits.join(", ")}` : undefined);
}

// ---------------------------------------------------------------------------
// 5. pboss DOCS.md example matches the implemented status() output.
// ---------------------------------------------------------------------------
const pbossDocsMd = readFileSync(join(PBOSS, "DOCS.md"), "utf8");
ok("pboss DOCS.md: per-user status header", pbossDocsMd.includes("# Boot startup service (systemd, per-user)"));
ok("pboss DOCS.md: Linger line in status example", pbossDocsMd.includes("#   Linger:     on — the daemon starts at BOOT, before login"));
ok("pboss DOCS.md: linger guidance present", pbossDocsMd.includes("loginctl enable-linger $USER"));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`docs consistency: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILED checks:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
