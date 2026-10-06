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
 * 2026-09-29 update: the universal (one-line) installer is HIDDEN from the
 * docs — its sections are commented out for a later re-add — while the
 * product focuses on JS/TS package-manager installs. Contract changes:
 *   - checks 3's installer-path mirrors (~/.local/bin, %LOCALAPPDATA%,
 *     PATH auto-add, "sudo is never required") are replaced by the
 *     package-manager trio checks (bun / npm / deno -A);
 *   - commented-out blocks are NOT documentation: every "is it documented"
 *     assertion runs on comment-stripped text;
 *   - one new guard: the one-line installer stays out of the rendered docs
 *     until it is deliberately re-added.
 *
 * 2026-10-04 update (pboss 1.6.0): the one-line installer RETURNS as the
 *    recommended path — runtime-aware, per the Universal Runtime-Aware
 *    Installation & CLI Architecture. The selection contract inverts:
 *   - the runtime is the user's explicit, persistent choice
 *     (~/.pboss/.runtime — a plain single-word file, never inside the
 *     package directory);
 *   - the installer takes --runtime=node|bun|deno (or asks; Node default)
 *     and installs the selected runtime when missing;
 *   - the Deno command is the /deno-entry subpath with --name pboss
 *     (deno executes npm package bins as modules — a shell wrapper
 *     cannot serve that path);
 *   - `pboss --runtime` as an info command is gone — the info lives in
 *     `pboss runtime`; the bare flag is now a usage error;
 *   - the old "never selects a runtime / no preference is ever persisted"
 *     claims are stale and must not render;
 *   - updates resolve the channel from the configured runtime.
 *
 * 2026-10-06 update (pboss 1.6.6, owner spec verbatim): ONE canonical Deno
 *    command everywhere — `deno install -g -A --min-dep-age=0 --name pboss
 *    --reload --force npm:pboss/deno-entry` (the install command plus
 *    --reload --force; the same command installs, reinstalls, and
 *    upgrades in place). Contract:
 *   - the canonical command is IDENTICAL on every surface that shows it
 *     (installation.md, intro.md, runtimes.md, pboss README.md, pboss
 *     DOCS.md) — no variant spellings;
 *   - --min-dep-age=0 rides every Deno install/one-off form (Deno ≥ 2.9's
 *     escape hatch for the 24-hour supply-chain hold; the unpinned spec
 *     resolves the release just published);
 *   - `pboss upgrade` displays and executes the same unpinned command
 *     under the bypass; the universal installer pins the exact version
 *     it installs instead;
 *   - the one-off `deno run` uses the /deno-entry subpath (the wrapper
 *     bin is a shell script — running it as a module is a SyntaxError);
 *   - the runtime-unique --permissions/--perms start flag is documented
 *     (runtimes.md + the processes.md options table).
 *
 * Run: bun scripts/test-docs-consistency.test.ts   (exit 0 = all checks pass)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const HERE = dirname(import.meta.path);
const DOCS_SITE = join(HERE, "..", "src", "content", "docs");
const PBOSS = join(HERE, "..", "..", "pboss");

/** The ONE canonical Deno install/upgrade command (owner spec, 2026-10-06) —
 *  identical on every surface, no variant spellings anywhere. */
const CANONICAL_DENO =
  "deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss/deno-entry";

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
const troubleshooting = readFileSync(join(DOCS_SITE, "troubleshooting.md"), "utf8");
const runtimes = readFileSync(join(DOCS_SITE, "runtimes.md"), "utf8");
const cluster = readFileSync(join(DOCS_SITE, "cli", "cluster.md"), "utf8");
const intro = readFileSync(join(DOCS_SITE, "intro.md"), "utf8");
const recipes = readFileSync(join(DOCS_SITE, "recipes.md"), "utf8");
const processes = readFileSync(join(DOCS_SITE, "cli", "processes.md"), "utf8");
const pbossReadme = readFileSync(join(PBOSS, "README.md"), "utf8");
const pbossDocsMd = readFileSync(join(PBOSS, "DOCS.md"), "utf8");

// 2026-09-29: commented-out sections are not documentation — the hidden
// universal installer must not satisfy any "is it documented" check.
const stripComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, "");

ok("installation: no-privileges requirement stated", /Privileges:\*\* none/.test(installation));
ok("installation: pre-1.5.0 ~/.local/bin upgrade note", stripComments(installation).includes("~/.local/bin"));
ok("installation: bun add -g without sudo", /```bash\nbun add -g pboss\n```/.test(installation));
ok("installation: one-liner has no sudo", !/curl -fsSL https:\/\/procboss\.com\/install\.sh \| sudo/.test(installation));
ok("installation: no sudo-optional claim", !installation.includes("sudo is optional"));
ok("installation: no PBOSS_INSTALL_DIR / PBOSS_NO_SUDO overrides", !/PBOSS_(INSTALL_DIR|NO_SUDO)/.test(installation));

// The install contract: the JS/TS package-manager trio — Bun, npm, Deno
// (canonical subpath form) — documented everywhere, with the runtime-aware
// one-line installer as the recommended path (pboss 1.6.0).
ok(
  "installation: package-manager trio documented (bun / npm / canonical deno)",
  ["bun add -g pboss", "npm install -g pboss", CANONICAL_DENO].every((s) =>
    stripComments(installation).includes(s)),
);
ok(
  "pboss README: package-manager trio mirrored",
  ["bun install -g pboss", "npm install -g pboss", CANONICAL_DENO].every((s) =>
    pbossReadme.includes(s)),
);
ok(
  "pboss DOCS.md: package-manager trio mirrored",
  ["bun add -g pboss", "npm install -g pboss", CANONICAL_DENO].every((s) =>
    pbossDocsMd.includes(s)),
);
ok(
  "installation: the one-line installer is the recommended path (1.6.0)",
  stripComments(installation).includes("curl -fsSL https://procboss.com/install.sh | sh") &&
    stripComments(installation).includes("powershell -c \"irm https://procboss.com/install.ps1 | iex\""),
);
ok(
  "installation: installer --runtime= flag forms documented",
  ["--runtime=node", "--runtime=bun", "--runtime=deno"].every((s) =>
    stripComments(installation).includes(s)),
);
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
// 3b. The runtime-agnostic install contract (pboss 1.5.0 → 1.6.0).
//    2026-10-04: the one-line installer RETURNS runtime-aware (pboss 1.6.0)
//    — it takes --runtime=node|bun|deno or asks (Node default), installs
//    the selected runtime when missing, installs the published package
//    through that runtime's ecosystem, and persists the selection. The
//    Deno install ships the /deno-entry subpath with --name pboss (deno
//    executes npm package bins as modules — a shell wrapper cannot serve
//    that path).
// ---------------------------------------------------------------------------
ok("installation: any-ONE-of-three runtimes requirement", /any ONE of/.test(installation));
ok("installation: npm global install documented", /```bash\nnpm install -g pboss\n```/.test(installation));
ok("installation: deno global install is the canonical command", installation.includes(CANONICAL_DENO));
ok("installation: deno permission section exists", installation.includes("### Deno's permission system"));
ok("installation: deno --allow-run documented", installation.includes("`--allow-run`"));
ok("installation: deno --allow-net documented", installation.includes("`--allow-net`"));
ok("installation: deno recommended install carries the hold bypass + refresh flags", installation.includes(
  "deno install -g --min-dep-age=0 --name pboss --reload --force --allow-run --allow-read --allow-write --allow-net --allow-env --allow-sys npm:pboss/deno-entry",
));
ok("installation: deno -A short form is the canonical command", installation.includes(CANONICAL_DENO));
ok("installation: no runtime-preference instruction", !/set `?PBOSS_RUNTIME/i.test(installation));
ok("installation: pre-1.5.0 upgrade path documented", /pre-1\.5\.0/.test(installation));
ok("installation: node engines floor documented", installation.includes("≥ 20.19"));

// ---------------------------------------------------------------------------
// 3d. The runtime-selection contract (pboss 1.6.0): the runtime is the
//     user's explicit, persistent choice — the wrapper dispatches, and
//     updates follow the selection.
// ---------------------------------------------------------------------------
ok("installation: the persistent selection file documented", stripComments(installation).includes("~/.pboss/.runtime"));
ok("installation: the selection never lives in the package directory", stripComments(installation).includes("never lives inside the package directory"));
ok("installation: pboss runtime change documented", stripComments(installation).includes("pboss runtime change"));
ok("installation: --runtime=<x> semantics documented", stripComments(installation).includes("--runtime=<node|bun|deno>"));
ok("installation: first-run interactive ask documented", stripComments(installation).includes("asks once"));
ok("installation: updates resolve the channel from the configured runtime", stripComments(installation).includes("resolves the update channel"));
ok("installation: the wrapper dispatch story told", stripComments(installation).includes("bin/pboss.sh"));
ok("installation: no stale 'installer never selects' claim", !stripComments(installation).includes("never selects a runtime"));
ok("installation: no stale 'never persists a preference' claim", !stripComments(installation).includes("never persists"));
ok("runtimes: the persistent selection documented", stripComments(runtimes).includes("~/.pboss/.runtime"));
ok("runtimes: no stale 'no preference is ever persisted' claim", !stripComments(runtimes).includes("no preference is ever persisted"));
ok("intro: the selection story told", stripComments(intro).includes("~/.pboss/.runtime"));
ok("troubleshooting: invalid runtime configuration entry", troubleshooting.includes("Invalid ProcBoss runtime configuration"));
ok("troubleshooting: the bare --runtime info command is gone", !stripComments(troubleshooting).includes("pboss --runtime"));

// ---------------------------------------------------------------------------
// 3e. The canonical Deno command contract (pboss 1.6.6, owner spec
//     2026-10-06): ONE command everywhere — the install command plus
//     --reload --force, the hold bypassed, the unpinned spec.
// ---------------------------------------------------------------------------
ok(
  "canonical deno command: identical on all five surfaces",
  [stripComments(installation), stripComments(intro), stripComments(runtimes), pbossReadme, pbossDocsMd].every((t) =>
    t.includes(CANONICAL_DENO)),
  "expected in installation.md, intro.md, runtimes.md, pboss README.md, pboss DOCS.md",
);
ok(
  "canonical deno command: no stale pre-1.6.6 spelling anywhere on the site",
  sitePages.every((f) => !readFileSync(f, "utf8").includes("deno install -g -A --name pboss npm:pboss/deno-entry")),
);
ok(
  "installation: supply-chain hold names the escape hatch",
  stripComments(installation).includes("--min-dep-age=0") &&
    stripComments(installation).includes("24-hour supply-chain hold"),
);
ok(
  "installation: no stale 'pin yesterday's version' advice",
  !stripComments(installation).includes("Pin yesterday's version"),
);
ok(
  "installation: the hold-bypass flag rides the update table's deno row",
  /Deno global \| `deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss\/deno-entry`/.test(installation),
);
ok(
  "installation: the --reload/--force doctrine stated (same command installs, reinstalls, upgrades)",
  stripComments(installation).includes("installs, reinstalls, and upgrades in place"),
);
ok(
  "installation: installer pins, upgrade runs unpinned — the distinction survives",
  stripComments(installation).includes("the installer pins the exact version it installs"),
);
ok(
  "installation: one-off deno run uses the subpath + hold bypass",
  stripComments(installation).includes("deno run -A --min-dep-age=0 npm:pboss/deno-entry list"),
);
// The runtime-unique --permissions start flag (pboss 1.6.2): runtimes.md
// sells it, the processes.md options table carries the row.
ok(
  "runtimes: the runtime-unique --permissions flag documented",
  stripComments(runtimes).includes("--perms") && stripComments(runtimes).includes("**Deno only**"),
);
ok(
  "processes: --permissions row in the start options table",
  processes.includes("`--permissions, --perms <list>`"),
);

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
// 3c-3. JS/TS-only focus (2026-09-29): the product focuses on JS/TS
//        backends — multi-language support is hidden from the docs
//        (commented out, dated for a later re-add), like the universal
//        installer. The first-class claim stays; the other-stack
//        marketing must not render.
ok("runtimes: first-class JS/TS claim", runtimes.includes("**JavaScript and TypeScript first-class treatment**"));
ok(
  "rendered docs: multi-language marketing stays hidden until re-added",
  [intro, runtimes, quickstart, recipes].every((t) => {
    const s = stripComments(t);
    return (
      !s.includes("Every other stack, still managed") &&
      !s.includes("In addition to that first-class") &&
      !/every other language alongside/.test(s) &&
      !/Go, Python, Rust, Ruby, PHP, Java/.test(s)
    );
  }),
);
ok(
  "intro: JS/TS-only positioning",
  stripComments(intro).includes("manages your JavaScript and TypeScript applications"),
);
ok("runtimes: per-runtime run sections exist", /### Running Bun applications/.test(runtimes) && /### Running Node\.js applications/.test(runtimes) && /### Running Deno applications/.test(runtimes));
ok("runtimes: pboss runtime documented (1.6.0 — bare --runtime is a usage error)", runtimes.includes("pboss runtime"));
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
