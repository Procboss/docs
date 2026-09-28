#!/usr/bin/env bun
/**
 * test-docs-consistency.ts — docs-vs-implementation consistency check.
 *
 * Owner rule: "For every update, write a test to confirm."
 *
 * Guards two documentation contracts:
 *
 * A. The per-user install contract (2026-09-10: no root, ever — user unit
 *    dir, systemctl --user, enable-linger, the PATH self-heal):
 *   1. No sudo command appears in any docs page or pboss DOCS.md/README —
 *      sudo is never invoked by the installer; the only tolerated mentions
 *      are prose statements and the snap channel (snapd design).
 *   2. The per-user facts ARE documented: user unit dir, systemctl --user,
 *      enable-linger.
 *   3. No stale system-service claims remain.
 *
 * B. The runtime-agnostic contract (pboss 1.5.0: one package executes under
 *    Bun, Node.js, or Deno, each through its OWN native APIs; the installer
 *    ensures at least one runtime exists, never selects one, installs the
 *    published npm package globally):
 *   1. The old "universal process manager" tagline and "built on Bun"
 *      positioning are gone from every page.
 *   2. installation.md states the any-ONE-of-three requirement, documents
 *      bun/npm/deno global installs, and covers Deno's permission system.
 *   3. runtimes.md documents the adapter layer, the detection order, the
 *      native API map, and the interpreter chain.
 *   4. cluster.md keeps every runtime's clustering native (node:cluster is
 *      Node's own module — never pboss's mechanism under Bun or Deno).
 *   5. The pboss DOCS.md startup status example matches the code output.
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
  ["elevated/root install explainer", "a normal shell installs per-user to"],
  ["bun toolchain-only explainer", "Bun is only the build toolchain"],
  ["boot-persistence auto explainer", "enables **boot persistence** automatically"],
  ["runtime version-floor essay", "Bun 1.1.30 or higher"],
  ["embedded-runtime reassurance", "embeds the Bun runtime and needs nothing else"],
  // The retired pre-1.5.0 positioning (owner: "instead of we saying its a
  // universal process manager, we can say a runtime agnostic process manager
  // for bun, node and deno, without sacrificing the native performances").
  ["old universal tagline", "universal process manager"],
  ["old bun-only positioning", "built on Bun native APIs"],
  ["old bun-only positioning (prose)", "built on native Bun APIs"],
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
const runtimes = readFileSync(join(DOCS_SITE, "runtimes.md"), "utf8");
const cluster = readFileSync(join(DOCS_SITE, "cli", "cluster.md"), "utf8");
const intro = readFileSync(join(DOCS_SITE, "intro.md"), "utf8");

ok("installation: no-privileges requirement stated", /Privileges:\*\* none/.test(installation));
ok("installation: pre-1.5.0 ~/.local/bin upgrade note", installation.includes("~/.local/bin"));
ok("installation: PATH auto-add on the per-user dir documented", installation.includes("adds it to your `PATH` automatically"));
ok("installation: bun add -g without sudo", /```bash\nbun add -g pboss\n```/.test(installation));
ok("installation: one-liner has no sudo", !/curl -fsSL https:\/\/procboss\.com\/install\.sh \| sudo/.test(installation));
// The no-root target contract (owner request, 2026-09-10): "we still dont
// need root … if ~/.local/bin is not in PATH in ~/.bashrc, then add it" —
// the installer NEVER invokes sudo; a missing PATH entry is added to the
// shell profile automatically instead of noted.
ok("installation: no sudo-optional claim", !installation.includes("sudo is optional"));
ok("installation: no PBOSS_INSTALL_DIR / PBOSS_NO_SUDO overrides", !/PBOSS_(INSTALL_DIR|NO_SUDO)/.test(installation));
ok("pboss DOCS.md: PATH self-heal mirrored", readFileSync(join(PBOSS, "DOCS.md"), "utf8").includes("adds it to your shell profile"));
ok("pboss README: PATH self-heal mirrored", readFileSync(join(PBOSS, "README.md"), "utf8").includes("adds it to your shell profile"));
ok("pboss DOCS.md: no-root contract mirrored", readFileSync(join(PBOSS, "DOCS.md"), "utf8").includes("sudo is never required"));
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
// 3b. The runtime-agnostic install contract (pboss 1.5.0).
// ---------------------------------------------------------------------------
ok("installation: any-ONE-of-three runtimes requirement", /any ONE of/.test(installation));
ok("installation: npm global install documented", /```bash\nnpm install -g pboss\n```/.test(installation));
ok("installation: deno global install documented", /deno install -g npm:pboss/.test(installation));
ok("installation: deno permission section exists", installation.includes("### Deno's permission system"));
ok("installation: deno --allow-run documented", installation.includes("`--allow-run`"));
ok("installation: deno --allow-net documented", installation.includes("`--allow-net`"));
ok("installation: deno recommended install with flags", installation.includes("deno install -g --allow-run --allow-read --allow-write --allow-net --allow-env --allow-sys npm:pboss"));
ok("installation: deno -A short form documented", installation.includes("deno install -g -A npm:pboss"));
ok("installation: installer never selects a runtime", installation.includes("never selects a runtime"));
ok("installation: no runtime-preference instruction", !/set `?PBOSS_RUNTIME/i.test(installation));
ok("installation: at-least-one runtime table", installation.includes("nothing installed, nothing selected"));
ok("installation: published package, no compiling", /never compiles anything/.test(installation));
ok("installation: pre-1.5.0 upgrade path documented", /pre-1\.5\.0/.test(installation));
ok("installation: node engines floor documented", installation.includes("≥ 20.19"));

// ---------------------------------------------------------------------------
// 3c. The runtime-agnostic architecture contract.
// ---------------------------------------------------------------------------
ok("intro: runtime-agnostic positioning", intro.includes("runtime-agnostic process manager for **Bun, Node.js, and Deno**"));
ok("intro: no-runtime-forced claim", intro.includes("No runtime is forced on you"));
ok("runtimes: the principle stated", runtimes.includes("runtime-agnostic, not runtime-generic"));
ok("runtimes: native APIs not sacrificed", /native APIs/.test(runtimes) && /never a compatibility layer/.test(runtimes));
ok("runtimes: adapter layer documented", runtimes.includes("### The adapter layer"));
ok("runtimes: detection order documented (Bun before Node)", runtimes.includes("Bun also exposes `process.versions.node`"));
ok("runtimes: no silent Node fallback", runtimes.includes("no silent fallback"));
ok("runtimes: native API map has all three runtimes", /`Bun\.spawn`/.test(runtimes) && /`node:child_process`/.test(runtimes) && /`Deno\.Command`/.test(runtimes));
ok("runtimes: node:cluster scoped to Node", runtimes.includes("`node:cluster` is Node's own clustering module"));
ok("runtimes: interpreter chain documented", /`bun run` → `deno run -A` → `node`/.test(runtimes) || /bun run` → `deno run -A` → `node --experimental-strip-types`/.test(runtimes));
// 3c-2. The tsx integration (v1.5.1): TypeScript under Node runs through
//        tsx — full TS, not just erasable syntax — with strip-types as the
//        zero-dependency fallback. The docs must sell exactly that.
ok("runtimes: tsx integration documented", runtimes.includes("[tsx](https://github.com/privatenumber/tsx)"));
ok("runtimes: tsx lookup order documented", /Your app's own `node_modules`/.test(runtimes) && /`tsx` on `PATH`/.test(runtimes));
ok("runtimes: tsx shipped as optional dependency", runtimes.includes("optional dependency of the pboss package"));
ok("runtimes: strip-types kept as the fallback", runtimes.includes("zero-dependency fallback"));
ok("runtimes: explicit interpreter stays verbatim (no tsx injection)", runtimes.includes("never injects tsx"));
// 3c-3. First-class focus: JS/TS lead, other languages limited to one
//        compact table — the owner's positioning request.
ok("runtimes: first-class JS/TS claim", runtimes.includes("**JavaScript and TypeScript first-class treatment**"));
ok("runtimes: other stacks compressed to one section", runtimes.includes("### Every other stack, still managed"));
ok("runtimes: per-runtime run sections exist", /### Running Bun applications/.test(runtimes) && /### Running Node\.js applications/.test(runtimes) && /### Running Deno applications/.test(runtimes));
ok("intro: in-addition positioning (trio first, everything else after)", intro.includes("In addition to that first-class Node, Bun and Deno support"));
ok("runtimes: pboss --runtime documented", runtimes.includes("pboss --runtime"));
ok("cluster: per-runtime spawn table", cluster.includes("`Bun.spawn`") && cluster.includes("`node:child_process`") && cluster.includes("`Deno.Command`"));
ok("cluster: node:cluster belongs to Node only", cluster.includes("it belongs to Node only"));
ok("cluster: reusePort guidance kept", cluster.includes("reusePort"));

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
// 6. Transport accuracy: the cloud agent link is the /ws/agent WebSocket
//    (Task 56) — the retired SSE stream must not be documented anywhere.
// ---------------------------------------------------------------------------
const agentApi = readFileSync(join(DOCS_SITE, "cloud", "agent-api.md"), "utf8");
const linkServer = readFileSync(join(DOCS_SITE, "cloud", "link-server.md"), "utf8");
const cloudMain = readFileSync(join(DOCS_SITE, "cloud.md"), "utf8");
for (const [name, text] of [
  ["cloud.md", cloudMain],
  ["cloud/link-server.md", linkServer],
  ["cloud/agent-api.md", agentApi],
] as Array<[string, string]>) {
  ok(`no SSE transport claims: ${name}`, !/\bSSE\b|EventSource|server-sent/i.test(text));
}
ok("agent-api: /ws/agent WebSocket documented", agentApi.includes("### GET /ws/agent"));
ok("agent-api: nine-command whitelist", agentApi.includes("process.deploy"));
ok("agent-api: server.deploy documented", agentApi.includes("server.deploy"));
ok("agent-api: log.watch documented", agentApi.includes("log.watch"));
// 6b. Reliability + security contract of the link (reboot/blackout hardening):
//     events are acked at-least-once, the watchdog re-dials dead sockets,
//     and TLS is enforced off-loopback with the 0700 home.
ok("agent-api: event-ack documented", agentApi.includes("event-ack"));
ok("agent-api: event outbox / at-least-once described", agentApi.includes("outbox"));
ok("agent-api: watchdog documented", agentApi.includes("watchdog"));
ok("agent-api: jittered backoff documented", agentApi.includes("jittered"));
ok("agent-api: TLS refusal documented", agentApi.includes("PBOSS_CLOUD_ALLOW_INSECURE"));
//     link confirmation: the hello gate, the dual-transport credential, and
//     the replaced close code are the proxy-mirage hardening (2026-09).
ok("agent-api: hello confirmation documented", agentApi.includes("`hello` — the registration ack"));
ok("agent-api: query-param credential transport documented", agentApi.includes("`?agent=` query parameter"));
ok("agent-api: mirage open explained", agentApi.includes("mirage"));
ok("agent-api: replaced close code documented", agentApi.includes("reason `replaced`"));
ok("agent-api: 0700 home documented", agentApi.includes("0700"));
ok("link-server: events survive outages", linkServer.includes("delivers any events"));
ok("link-server: TLS-only claim", linkServer.includes("refused off-loopback"));
ok("link-server: 0700 home claim", linkServer.includes("0700"));
ok("link-server: WebSocket link described", linkServer.includes("WebSocket"));
// reinstall/upgrade permanence (Task 69): the credential is a permanent
// cache that survives binary swaps, and every install/upgrade/status
// moment re-checks for it.
ok("link-server: reinstall permanence documented", linkServer.includes("permanent cache"));
ok("link-server: status self-heal documented", linkServer.includes("picks it up even if the file appeared after the daemon started"));
ok("installation: reinstall keeps the cloud link", installation.includes("survive the binary swap"));
ok("cloud.md: WebSocket transport described", cloudMain.includes("/ws/agent"));
ok("cloud.md: deploy commands listed", cloudMain.includes("deploy"));

// ---------------------------------------------------------------------------
// 7. Conciseness guard: no paragraph or list item over 100 words anywhere
//    (the owner's "no walls of text" rule — prose blocks get trimmed, not
//    tables/code, which are excluded below).
// ---------------------------------------------------------------------------
function proseItems(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const out: string[] = [];
  for (const p of text.split(/\n\s*\n/)) {
    const para = p.trim();
    if (!para || para.startsWith("```") || para.startsWith("|") || para.startsWith("#") || para.startsWith("- [")) continue;
    // split consecutive list items so a bullet LIST is not counted as one block
    if (/^[-*\d]/.test(para)) out.push(...para.split(/\n(?=[-*] |\d+\. )/));
    else out.push(para);
  }
  return out;
}
for (const file of [...sitePages, ...pbossDocs]) {
  const bad = proseItems(file).filter((i) => i.split(/\s+/).length > 100);
  ok(
    `concise (<100w per item): ${file.split("/").slice(-2).join("/")}`,
    bad.length === 0,
    bad.length ? `${bad[0].split(/\s+/).length}w item starts "${bad[0].slice(0, 60)}…"` : undefined,
  );
}

// ---------------------------------------------------------------------------
// 8. License sanity: DOCS.md declares GPL-3.0-only and must not paste the
//    MIT permission grant under it (the mismatch fixed in Task 62).
// ---------------------------------------------------------------------------
ok(
  "pboss DOCS.md: no MIT grant text under GPL header",
  !pbossDocsMd.includes("Permission is hereby granted, free of charge"),
);
ok("pboss DOCS.md: license points at LICENSE file", pbossDocsMd.includes("GPL-3.0-only — see [LICENSE](LICENSE)"));
ok("pboss DOCS.md: cloud credential permanence documented", pbossDocsMd.includes("**permanent cache**"));
ok("pboss DOCS.md: upgrade verifies the resumed link", pbossDocsMd.includes("verifies the link came back"));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`docs consistency: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILED checks:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
