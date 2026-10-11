# Verify-first spike (spec §13), 2026-10-11

Throwaway workspace: `/tmp/ta-spike-kv3j/pnpm` (pnpm) and `/tmp/ta-spike-kv3j/npm` (npm copy for item 7). Linux, node v24.20.0, pnpm 12.11.2 (`npx pnpm@12.11.2`), npm 11.19.0, turbo 2.11.7, @playwright/test 1.64.0. Layout as plan Task 1: `apps/web`, `apps/web-e2e` (`tests/a.spec.ts`, `tests/b.spec.ts`, `tests/auth.setup.ts`, `helpers/h.ts`, setup project `setup` + `main` depending on it), `tools/web-e2e-atoms` (hand-written atoms), `tools/turbo-atomizer` (stub `exec.cjs`). Root `turbo.json` has `futureFlags.experimentalTaskCommand: true`. turbo's bundled docs (`node_modules/turbo/docs/`) were used as the reference.

**Gate result: FAIL.** Items 1, 2, 8 and 11 fail as specified. The spec must change before Task 2+ continue (§13 rule). Item 11 was run in a follow-up; the parent agent made the commits because the user's commit-guard hook blocks this agent.

## Results

| # | Item | Command | Observed | Result |
|---|---|---|---|---|
| 1 | Inputs, spec §4 shape | `turbo run e2e-ci --dry=json`, read `tasks[].hash` and `tasks[].inputs` after each edit | The own spec and its snapshots are **not** in the task's inputs: `inputs` = `helpers/h.ts package.json playwright.config.ts tests/auth.setup.ts turbo.json`. A negated glob always wins over a later positive entry, whatever the order. Edits: (1) `a.spec.ts` → no hash changed; (2) unsynced `c.spec.ts` → none; (3) add atom c → a, b unchanged; (4) `a.spec.ts-snapshots/x.png` → no hash changed; (5) `helpers/h.ts` → a, b, c changed; (6) `turbo-atomizer.json` → none | **FAIL** (edits 1, 4) |
| 1b | Brace globs in turbo | same | `!**/*.{spec,test}.{ts,…}` excluded `a.spec.ts`/`b.spec.ts` and kept `auth.setup.ts` | PASS |
| 1c | Brace globs in `matchesGlob` | `node -e "console.log(require('node:path').matchesGlob('tests/a.spec.ts','**/*.{spec,test}.{ts,tsx}'))"` | `true` (full 8-extension list also `true`; `tests/h.ts` → `false`) | PASS |
| 2 | Passthrough args | atom `["node","-e","console.log(JSON.stringify(process.argv.slice(1)))","x"]`; `turbo run e2e-ci -- --grep foo` | atoms print `["x"]`. Same for `turbo run e2e-ci--all -- --grep foo` (with or without `--filter`). Only a task named on the command line receives them: `turbo run e2e-ci--tests/a.spec.ts -- --grep foo` → `["x","--grep","foo"]`. Documented: `docs/reference/run.mdx:33` ("passed to all tasks that are named in the run command"). The args are still hashed into every task, including `web#build` (`--dry=json` `cliArguments`; `docs/crafting-your-repository/caching.mdx:247`) | **FAIL** |
| 3 | Strict env | atom prints `Object.keys(process.env).sort()` and spawns a detached child that writes its keys to a file 3 s later; `FOO=1 BAR=2 turbo run e2e-ci --filter=web-e2e --force` | Task and child get the same keys: `COLORTERM COREPACK_ENABLE_AUTO_PIN DBUS_SESSION_BUS_ADDRESS DISPLAY HOME LANG PATH PWD SHELL TERM TURBO_HASH TURBO_INVOCATION_DIR USER XAUTHORITY XDG_DATA_DIRS XDG_RUNTIME_DIR`. With `passThroughEnv: ["FOO"]`, `env: ["BAR"]`: the same plus `BAR`, `FOO`, also in the child. `TMPDIR` is stripped (set `TMPDIR=…` → absent); `CI` passes | PASS |
| 4 | `turbo query` file deps | see "Query strings" | `apps/web-e2e/helpers/h.ts` listed, plus `node_modules/.pnpm/...d.ts` files and 2 resolve errors (`zod` from playwright-core types). Exit 0 either way; `emitErrors: false` silences stderr | PASS |
| 5 | Describe run | `b.spec.ts` throws at top level; `time node <@playwright/test bin> test --list --reporter=json --test-list <empty file>` | exit 0, 0.34 s, `config.rootDir` = `…/apps/web-e2e/tests`, `config.metadata` = `{"turbo-atomizer":{"version":1,"marker":"spike"}}`, `errors: []`. Control without `--test-list`: exit 1, `Error: b top-level throw` | PASS |
| 6 | Windows/macOS | — | Deferred to Task 13 | DEFERRED |
| 6L | Linux detached child | as item 3 | Turbo returned 33 ms after the atom exited (child still sleeping); the child wrote its file 3 s later with the atom pid already dead | PASS |
| 7 | CJS `require` | atom `["node","-e","require('turbo-atomizer/exec')","tests/a.spec.ts","a.spec.ts"]`, `turbo-atomizer` = root devDependency only (`workspace:*` pnpm, `*` npm), `turbo run e2e-ci --force` | pnpm and npm: `exec argv ["tests/a.spec.ts","a.spec.ts"] cwd …/apps/web-e2e`. Windows quoting deferred to Task 13; turbo docs say `command` "runs directly without a shell" (`docs/guides/tools/rust.mdx:112`) | PASS (Linux) |
| 8 | `extends` layout | `turbo run <t> --dry=json` for `e2e-ci`, `e2e-ci--all`, `e2e-ci--tests/a.spec.ts` | `e2e-ci`: only `web-e2e#…` tasks (+ `web#build`). `e2e-ci--all` **also schedules** `web-e2e-atoms#e2e-ci--all` and both `web-e2e-atoms#e2e-ci--tests/*`; the direct run also schedules `web-e2e-atoms#e2e-ci--tests/a.spec.ts`. With `--filter=web-e2e`, neither does. `turbo run 'web-e2e#e2e-ci--tests/a.spec.ts'` → `Could not find task` | **FAIL** (`--all`); direct run = spec fallback |
| 9 | `--continue` | atom a `process.exit(1)` at once, b finishes after 1 s; `turbo run e2e-ci --concurrency=3 --force [--continue=dependencies-successful]` | Without the flag b is killed (never prints), exit 1. With it b prints `ran tests/b.spec.ts`, exit 1, `Failed: web-e2e#e2e-ci--tests/a.spec.ts` | PASS |
| 10 | Setup project with `--test-list` | `playwright test --test-list list.txt --reporter=json`, `list.txt` = `a.spec.ts` | `setup :: auth.setup.ts :: do setup :: passed`, `main :: a.spec.ts :: a works :: passed` | PASS |
| 11 | `--affected` | committed base, edit `a.spec.ts`, `turbo run e2e-ci --affected --dry=json` (see "Follow-up: item 11") | Every file task is selected in every inputs shape, with or without `futureFlags.affectedUsingTaskInputs` | **FAIL** |
| — | `command` needs the flag | `turbo run e2e-ci --dry=json` with `futureFlags` removed | `The command field requires futureFlags.experimentalTaskCommand in the root turbo.json.`, exit 1 | confirms §3 |

## Query strings (item 4)

File dependencies of a spec (path relative to the repo root):

```graphql
{ file(path: "apps/web-e2e/tests/a.spec.ts") { dependencies(emitErrors: false) { files { items { path } } errors { items { message } } } } }
```

Workspace dependencies of the test package and their task names. `tasks` lists both native scripts and configured tasks, so `web#start` appears too:

```graphql
{ package(name: "web-e2e") { directDependencies { items { name path tasks { items { name fullName script command } } } } } }
```

Observed: `web` → `web#build`, `web#start`.

The resolved `dependsOn` of the file tasks. This is the more direct check for doctor, because `^build` is already resolved:

```graphql
{ package(name: "web-e2e") { tasks(filter: { has: { field: TAG, value: "atomizer:e2e-ci" } }) { items { fullName tags command directDependencies { items { fullName } } } } } }
```

Observed: `web-e2e#e2e-ci--tests/a.spec.ts` → `directDependencies` `web#build`. The `command` field comes back as one space-joined string.

Other argument shapes: `dependencies(depth: Int, tsConfig: String, importType: ALL|TYPES|VALUES, emitErrors: Boolean)`.

## Derived default `passThroughEnv`

`[]`. PATH, HOME, USER, LANG, SHELL, TERM and XDG_* already pass under strict mode, and the detached child inherits the same set. `TMPDIR` does not pass. Every exec runs under turbo, so all of them compute the same `os.tmpdir()` socket path. A process outside turbo that has `TMPDIR` set (always the case on macOS) would compute a different path. Re-check on macOS/Windows in Task 13.

## Failures and minimal spec fixes

**F1, item 1: own-spec re-inclusion.** Turbo applies every negated input glob after all positive ones, so the own spec and its snapshots never enter the hash. This breaks the core correctness rule (§8): an edited spec replays its old pass. Three working alternatives were measured. (a) and (b) pass edits 1, 3, 4, 5 and 6 with identical hashes; (c) passes all 6:

- (a) **JIT re-include.** Use `"$TURBO_DEFAULT$", "!<specGlobs>", "!<snapshotGlobs>", "!turbo-atomizer.json", { "mode": "jit", "globs": ["<spec>", "<spec>-snapshots/**"] }`. Edit 2 also passes. Cost: `--dry=json` reports `hash: null`, `hashReason: "Deferred because JIT hashing mode was used."`, and `cache.status: "MISS"` even for cached tasks (umbrella and `--all` too). That breaks §9 "cache state from `--dry=json`". The real run caches normally (HIT on rerun). jit globs do count for task-level `--affected` (follow-up). 302 specs: 193 KB file, 0.19–0.55 s dry run.
- (b) **Static negation of every other synced spec.** Use `"$TURBO_DEFAULT$", "!<other spec>", "!<other spec>-snapshots/**" …, "!turbo-atomizer.json"`. `--dry=json` keeps real hashes. Costs: the file is quadratic (302 specs: 7.6 MB, 3.3 s and 481 MB RSS for `--dry=json`), and an unsynced new spec changes every hash until `sync` runs (edit 2 fails; this is safe, it only causes extra reruns, and CI's `sync --check` catches it first).

Hash note: turbo hashes the resolved file set, not the glob list. Reordering globs and adding atom c left the other hashes unchanged.

- (c) **Carrier task** (follow-up section). The own spec is carried through a cacheable no-op dependency. All 6 edits pass, `--dry=json` keeps real hashes and cache state, and the file grows linearly (302 specs: 265 KB). Costs: 2N+1 tasks per run; a fully cached rerun takes 0.34–0.42 s against 0.21–0.26 s, and a cold stub run 2.9 s against 1.0–1.3 s.

**Recommendation: (c).** It is the only shape that is correct on all 6 edits and keeps the §9 cache-state contract without quadratic growth. Rules (c) needs in the spec:
- A carrier name that cannot collide with a file task. `e2e-ci--src--tests/a.spec.ts` is also the file-task name of a spec at `src--tests/a.spec.ts`. Use a different prefix, such as `<task>-src--<path>` (file tasks always start `<task>--`).
- Carriers get their own tag, `atomizer:carrier`, never `atomizer:<task>`. The Console, `merge-reports` (blob count) and `sync --check` summaries select file tasks by the `atomizer:<task>` tag.
- No outputs.

Spec sections to change: §3 "Task inputs", §4 example and generation rules (key order, the carrier entry and its sort position), §8 first rule, §9 (carrier tag; file tasks are identified by tag), §13.1. Plan tasks affected by (c): 4 (task and carrier builder), 7 (sync output and summary), 12 (e2e expectations), 14 (doctor reads file tasks by tag), 16 (Console contract), 17 (merge-reports counts file tasks by tag). (a) would affect 4, 7, 12 and 16 (cache state no longer readable from `--dry=json`); (b) would affect 4, 7 and 12, plus a size limit in the docs.

**F2, item 2: passthrough args.** `turbo run e2e-ci -- <args>` never reaches the file tasks. They are dependencies of the umbrella, and turbo forwards args only to tasks named on the command line. The args also bust the cache of `web#build`. Minimal fix: forward Playwright args through an env var that every atom lists in `env`, for example `TURBO_ATOMIZER_ARGS`. Values listed in `env` reach the task under strict mode (item 3, `BAR`) and are hashed. exec appends the parsed value after the fixed args, and the zero-test-guard filter detection applies to it. Keep `-- <args>` documented only for a single named file task. Spec sections: §6.3 (argv, step 8), §4 generated example (`env`), §13.2. Plan tasks affected: 4/7 (generated `env`), 8 (exec argv), 12 (e2e).

**F3, item 8: generated package copies.** Running `<task>--all` or a file task by name also schedules the copies that belong to the generated package. exec step 1 makes each copy fail, so the run fails. The umbrella `turbo run e2e-ci` is fine. Minimal fix, either:

- docs require `--filter=<test package>` for `<task>--all` and direct file runs, and exec's guard message names that flag; or
- exec exits 0 with a one-line notice when its cwd is the generated package. Then the run passes, but turbo caches no-op copies.

Spec sections: §6.3 step 1, §13.8, README. Plan tasks affected: 8 (exec guard), 12, 18 (docs).

**F4, item 11: `--affected` through the umbrella.** `turbo run e2e-ci --affected` never selects a subset. The umbrella (and `--all`) is affected whenever any file task is, either through its own default inputs or through the affected dependency it depends on, and turbo then runs every dependency of a selected task. Subsets work only when the file tasks are named and `futureFlags.affectedUsingTaskInputs` is on (follow-up section). Minimal fix:
- `init` also sets `futureFlags.affectedUsingTaskInputs: true` (a global-hash change, like the existing flag), and doctor checks it.
- The §4 CI recipe replaces `turbo run e2e-ci --affected …` with an atomizer step. It reads affected file tasks with `{ affectedTasks(taskFilter: { has: { field: TAG, value: "atomizer:<task>" } }) { items { fullName } } }` and runs `turbo run <file task names…> --filter=<test package> --continue=dependencies-successful`. The step can be a new CLI command or a documented one-liner.
- An empty selection is a passing no-op.
- Long name lists may hit the Windows command-line limit (about 32 K characters, roughly 800 tasks at 40 characters each; inferred, check in Task 13).

Spec sections: §3 "Experimental flag" / "CI flags", §4 CI recipe, §6 (new command if chosen), §6.1 step 7, §6.4, §13.11. Plan tasks affected: 10 (init flag), 11 (CLI wiring, if a command), 12 (e2e), 13 (Windows argv length), 14 (doctor flag check), 18 (README CI recipe).

## Follow-up: option (c) "carrier task" for F1

Shape: each spec gets a no-op task, `e2e-ci--src--<spec>`, with `command: ["node","-e","0"]`, `inputs: ["<spec>", "<spec>-snapshots/**"]`, no outputs and tag `atomizer:carrier`. The file task keeps the §4 inputs and depends on its carrier: `dependsOn: ["^build", "e2e-ci--src--<spec>"]`. turbo folds dependency hashes into the dependent's hash, so the carrier carries the own spec into the file task's hash. `command: ["node","-e",""]` is rejected: `` `command` arguments cannot be empty strings ``.

Edits from item 1, measured with `--dry=json` (file-task hashes):

| Edit | a | b | c | Expected |
|---|---|---|---|---|
| 0 baseline | `ed6bc913` | `adb62766` | — | — |
| 1 `a.spec.ts` | `8496390d` | `adb62766` | — | only a ✔ |
| 2 unsynced `c.spec.ts` | `8496390d` | `adb62766` | — | none ✔ |
| 3 atom c added | `8496390d` | `adb62766` | `7417794d` | a, b unchanged ✔ |
| 4 a snapshot | `82449254` | `adb62766` | `7417794d` | only a ✔ |
| 5 `helpers/h.ts` | `25b35255` | `dd8dd19b` | `743eb427` | all ✔ |
| 6 `turbo-atomizer.json` | `25b35255` | `dd8dd19b` | `743eb427` | none ✔ |

The carrier hashes change only on edits 1 and 4 (a's carrier) and are unchanged by edit 5. After a real run, `--dry=json` reports real hashes and `cache.status: "HIT"` for file tasks and carriers. The umbrella and `--all` show `MISS` because they have no command, the same as in the plain shape. Scheduling is unchanged: the umbrella schedules only `web-e2e#…` tasks. A direct run schedules the file task, its carrier, `web#build` and the copies in `web-e2e-atoms` (F3 still applies); with `--filter=web-e2e`, only the first three. Every run reports 2N+1 tasks (`Tasks: 5 successful, 5 total` for 2 specs), and the carriers replay from cache too.

Scale, 302 specs, `--filter=web-e2e`. Cold and cached runs use the stub atom (`node -e console.log`) and include `web#build`:

| Shape | Generated file | `--dry=json` | Cold run | Fully cached rerun | Own-spec edit hashed | Real dry hashes |
|---|---|---|---|---|---|---|
| plain (§4 as written) | 167 KB | 0.27–0.36 s, 176–209 MB | 1.27 s (303 tasks) | 0.25–0.26 s | no | yes |
| (a) jit | 193 KB | 0.19 s, 107 MB | 1.01 s (303) | 0.21–0.24 s | yes | no (`null`, MISS) |
| (b) static negation | 7.6 MB | 2.56–3.28 s, 481–492 MB | 6.24 s (303) | 2.66–2.80 s | yes | yes |
| (c) carrier | 265 KB | 0.28–0.29 s, 235–237 MB | 2.92 s (605 tasks) | 0.34–0.42 s | yes | yes |

## Follow-up: item 11 (`--affected`)

Each dir is a copy of the pnpm workspace (`/tmp/ta-spike-kv3j/affected-<shape>[-flag]`) with 2 specs, `git init -b main` and one `base` commit made by the parent agent. `-flag` dirs set `futureFlags.affectedUsingTaskInputs: true`, and every dir sets `agentGuidance: false`. Before the edit, `turbo run e2e-ci --affected --dry=json` selects nothing in all 8 base dirs. Edit: append a line to `apps/web-e2e/tests/a.spec.ts`, uncommitted. Tasks listed are `web-e2e#…` unless shown with a package; carrier ids are shortened to `src--a`/`src--b`.

| Shape | Flag | `turbo run e2e-ci --affected --dry=json` | `turbo run e2e-ci--tests/a.spec.ts e2e-ci--tests/b.spec.ts --filter=web-e2e --affected --dry=json` | `turbo query` `affectedTasks(taskFilter: TAG atomizer:e2e-ci)` |
|---|---|---|---|---|
| plain (§4) | off | web#build, e2e-ci, --all, a, b | web#build, a, b | web#build, a, b |
| plain (§4) | on | web#build, e2e-ci, --all, a, b | **none** | none |
| (a) jit | off | web#build, e2e-ci, --all, a, b | web#build, a, b | web#build, a, b |
| (a) jit | on | web#build, e2e-ci, --all, a, b | web#build, **a** | web#build, a |
| (b) static | off | web#build, e2e-ci, --all, a, b | web#build, a, b | web#build, a, b |
| (b) static | on | web#build, e2e-ci, --all, a, b | web#build, **a** | web#build, a |
| (c) carrier | off | web#build, e2e-ci, --all, src--a, src--b, a, b | web#build, src--a, src--b, a, b | web#build, src--a, src--b, a, b |
| (c) carrier | on | web#build, e2e-ci, --all, src--a, src--b, a, b | web#build, src--a, **a** | web#build, src--a, a |

Control round (`affected-{a,b,c}-flag-u`): the same flag dirs, but `e2e-ci` and `e2e-ci--all` get `inputs: ["__none__"]` so that a spec edit cannot affect them directly. `turbo run e2e-ci --affected` and `turbo run e2e-ci--all --affected` still select a and b in all three shapes. `{ affectedTasks { items { fullName } } }` lists `e2e-ci` and `e2e-ci--all` as affected, so they become affected through their dependency.

Findings:
- Task-level selection needs the flag. Without it, `--affected` works per package, so a and b are selected.
- jit globs count as inputs for task-level matching.
- A carrier's affected state propagates to its dependent file task.
- With the §4 shape and the flag on, an edited spec selects nothing, because it is excluded from every task's inputs. A real change would be missed.
- Any entry through the umbrella or `--all` runs every file task. A subset needs named file tasks (F4).

## Milestone 2 measurements

Per-file start-up cost from `startup-cost.spec.ts` (plan Task 12, step 4). Three local runs of `vitest run --config packages/turbo-atomizer-e2e/vitest.e2e.config.ts src/startup-cost.spec.ts` at commit `512a35e`, right after `nx build turbo-atomizer`. Linux 7.0.0, Intel i7-13700H (20 threads), 30 GB RAM, node v24.20.0, turbo 2.11.7, @playwright/test 1.64.0 with the Chromium headless shell. Another agent was building on the same machine (load average 2–3).

Workspace: the pnpm-basic fixture after `init` and `sync`. It has 6 specs, a setup project and one web server, so `turbo run e2e-ci` runs 13 tasks: 6 file tasks, 6 carriers and `web#build`. Turbo's default concurrency (10) runs all 6 file tasks at once. "Run" is the wall time of the whole `turbo run e2e-ci --summarize`. "Mean" is the mean `execution.endTime - execution.startTime` of the file tasks in the run summary. Each file task starts Playwright, runs the setup project, launches Chromium and runs its 1 or 2 tests.

| Run | Cold: file tasks | Cold: run | Cold: mean per file task | Cached: run | Cached: mean per file task |
|---|---|---|---|---|---|
| 1 | 6 | 2106 ms | 1862 ms | 44 ms | 1 ms |
| 2 | 6 | 2088 ms | 1864 ms | 42 ms | 0 ms |
| 3 | 6 | 2071 ms | 1864 ms | 45 ms | 1 ms |

- A cold file task costs about 1.86 s, and almost all of it is fixed start-up cost: the tests themselves take 50–120 ms each and the setup test 12–27 ms (Playwright's per-test times in the e2e output). With 6 tasks in parallel, the whole cold run takes about 2.1 s, and the web server starts once.
- A fully cached rerun of the 13 tasks takes 42–45 ms, with no server start.
- These are local numbers on a fast machine, from a single small suite. They say nothing about CI runners or about the 200-file consumer suite.

## Other observations

- turbo 2.11.7 writes a managed `AGENTS.md` at the workspace root when it detects an AI agent (opt out: `"agentGuidance": false` in the root `turbo.json`). The e2e fixtures (Task 12) should set it, or the fixture tree changes on the first run.
- `require.resolve('@playwright/test/cli.js')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. Resolving `package.json` and reading `bin.playwright` (spec §6) works.
- In 3 early runs, `node_modules/.bin/playwright` (gitignored) showed up in the `$TURBO_DEFAULT$` inputs. It did not reproduce later. Cause unknown; worth watching in Task 12.
- The package name `turbo-atomizer` is unclaimed on npm (`npm view turbo-atomizer` → 404).
