# turbo-atomizer

Turn every Playwright spec file of a [Turborepo](https://turborepo.com) workspace package into its own turbo task.

Each file then gets turbo's local and remote cache, affected-only selection, and retry-only-what-failed. You add no scripts to any `package.json`.

- With nothing changed, every file replays from cache and no web server starts.
- After you edit one spec, only that file runs.
- After a failed CI attempt, the retry runs only the failed files.
- Adding or removing a spec changes no other file's hash.
- Editing the app under test invalidates every file.

Version `0.x`: the API can still change. The e2e suite in this repo runs on Linux with pnpm.

## How it works

`turbo-atomizer sync` lists your specs with Playwright and writes one turbo task per file into a generated workspace package. Your test package extends that package, so turbo sees the tasks without any change to your scripts.

| Name                              | Meaning                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `e2e-ci`                          | Umbrella task. Depends on `e2e-ci--all`. The name is configurable (`task`).                    |
| `e2e-ci--tests/login.spec.ts`     | File task. Runs one spec file with Playwright.                                                 |
| `e2e-ci-src--tests/login.spec.ts` | Carrier task. A cached no-op that brings the spec and its snapshots into the file task's hash. |
| `e2e-ci--all`                     | Depends on every file task.                                                                    |

An edit to one spec reaches only that file's hash, through its carrier. Every other file input (helpers, fixtures, Playwright config, the app under test) is shared by all file tasks.

The file tasks use turbo's experimental `command` field. See [The experimental-flag risk](#the-experimental-flag-risk).

## Requirements

| Needs              | Version                |
| ------------------ | ---------------------- |
| Node               | `>=24`                 |
| `turbo`            | `>=2.11.7 <2.12.0`     |
| `@playwright/test` | `>=1.56.0`             |
| Package manager    | pnpm or npm workspaces |

## Install

Add the package to the workspace root:

```sh
pnpm add -D -w turbo-atomizer
```

With npm workspaces: `npm install -D turbo-atomizer`.

## Set up a test package

Do these steps once per test package. The examples use a pnpm workspace with an app `web` and a test package `web-e2e`.

**1. Declare the app under test as a workspace dependency of the test package.** Its build output then reaches every file's hash.

```json
{
  "name": "web-e2e",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "web": "workspace:*"
  },
  "devDependencies": {
    "@playwright/test": "1.64.0"
  }
}
```

Under npm workspaces, use `"*"` instead of `"workspace:*"`. The dependency needs a task that `dependsOn` matches (default `^build`), here the `build` script of `web`.

**2. Wrap the Playwright config in `withAtomizer`.** The helper is required: atomizer reads the config's reporters, web servers and setup projects through it. Outside atomizer it returns your config untouched.

```ts
import { defineConfig, devices } from '@playwright/test';
import { withAtomizer } from 'turbo-atomizer/playwright';

const baseURL = 'http://127.0.0.1:3000';

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    reporter: 'list',
    use: { baseURL },
    projects: [
      { name: 'setup', testMatch: /.*\.setup\.ts/ },
      { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] }
    ],
    webServer: { command: 'node ../web/server.js 3000', url: baseURL }
  })
);
```

**3. Run `init` from the workspace root.**

```sh
npx turbo-atomizer init --package apps/web-e2e
```

`init` is idempotent. A second run changes nothing and installs nothing. Its output on a fresh workspace:

```text
apps/web-e2e: initialized
  changed: apps/web-e2e/turbo-atomizer.json
  changed: tools/web-e2e-atoms/ (generated package web-e2e-atoms)
  changed: pnpm-workspace.yaml
  changed: root turbo.json futureFlags
  changed: apps/web-e2e/turbo.json
  changed: .gitignore
Commit pnpm-lock.yaml with these changes; the install added the generated package to it.
```

`init` does these steps, checking before each write:

- Detects the package manager from the lockfile (`pnpm-lock.yaml` or `package-lock.json`). Anything else is an error.
- Checks the installed turbo and Playwright versions. A version below the minimum stops `init` before it writes anything.
- Writes `turbo-atomizer.json` in the test package, unless a config exists.
- Creates the generated package (`tools/<test-package-dir>-atoms`, name `<test-package-name>-atoms`) and adds it to the workspace globs. Pass `--generated-dir <dir>` to choose another directory.
- Sets both [root future flags](#the-experimental-flag-risk) in `turbo.json` or `turbo.jsonc`.
- Writes the test package's `turbo.json` (below). It never overwrites an existing one. If the file defines your task without `dependsOn: ["<task>--all"]`, or `package.json` has a script named like the task, `init` stops and prints the edit to make.
- Adds `turbo-atomizer` to the root `devDependencies` unless it is already listed, and adds `.atomizer/` and `playwright.atomizer-merge.config.mjs` to `.gitignore`.
- Runs the package manager's install once, so the lockfile includes the generated package.
- Runs `sync` when the Playwright config already uses `withAtomizer`. Otherwise it prints the remaining steps and exits 0. `init` never edits your Playwright config.

The test package's `turbo.json`, written once:

```json
{
  "extends": ["//", "web-e2e-atoms"],
  "tasks": {
    "e2e-ci": {
      "dependsOn": ["e2e-ci--all"]
    }
  }
}
```

The root `turbo.json` gains:

```json
{
  "futureFlags": {
    "experimentalTaskCommand": true,
    "affectedUsingTaskInputs": true
  }
}
```

**4. Build the workspace packages the specs import, then sync and commit.** `sync` loads your specs, so anything they import must exist.

```sh
npx turbo run build --filter=web-e2e^...
npx turbo-atomizer sync
```

Commit the generated package, the lockfile and the changed config files. Re-run `sync` and commit whenever you add, rename or remove a spec, or change the atomizer config.

**5. Run the suite.**

```sh
npx turbo run e2e-ci
```

The first run after `init` misses every cache once, because the future flags are part of turbo's global hash.

### What a generated task looks like

The generated package holds a private `package.json` and a `turbo.json` that `sync` rewrites each time. The carrier of one spec:

```json
{
  "tags": ["atomizer:definitions"],
  "tasks": {
    "e2e-ci-src--tests/cart.spec.ts": {
      "command": ["node", "-e", "0"],
      "inputs": ["tests/cart.spec.ts", "tests/cart.spec.ts-snapshots/**"],
      "tags": ["atomizer:carrier"]
    }
  }
}
```

The file task of the same spec runs `node -e "require('turbo-atomizer/exec')" tests/cart.spec.ts cart.spec.ts --atomizer-blob --config=playwright.config.ts`. It inherits turbo's default inputs minus every spec and snapshot folder, depends on `^build` and on its carrier, and caches its output under `.atomizer/<slug>/`. Do not edit the generated `turbo.json`: `sync` overwrites it and `doctor` flags it as stale.

## Run in CI

```sh
npx turbo run build --filter=web-e2e^...   # specs may import built workspace packages
npx turbo-atomizer sync --check            # exit 1 if the generated tasks are stale
npx turbo-atomizer doctor                  # exit 1 on any setup error
npx turbo-atomizer affected                # runs only the affected file tasks
npx turbo-atomizer merge-reports           # run this step even when the one before failed
```

Replace the build filter with your test package's name. A job that runs the whole suite swaps the `affected` step for:

```sh
npx turbo run e2e-ci --continue=dependencies-successful
```

`--continue=dependencies-successful` keeps the other file tasks running after one fails. Together with a turbo cache that outlives the CI attempt (remote cache, or a persisted cache folder), a retry of the job replays the passed files and runs only the failed ones.

### Why `affected` and not `turbo run --affected`

`turbo run e2e-ci --affected` runs every file task as soon as one is affected, because the umbrella and `e2e-ci--all` become affected through their dependencies. `turbo-atomizer affected` asks turbo which file tasks are affected, then runs exactly those:

```sh
npx turbo-atomizer affected
npx turbo-atomizer affected -- --concurrency=4
```

- Base and head come from turbo's defaults and the `TURBO_SCM_BASE` and `TURBO_SCM_HEAD` variables.
- Args after `--` go to `turbo run`.
- With nothing affected it prints `no affected file tasks in <test package name>` and exits 0 without running turbo.
- Otherwise it exits with turbo's exit code.

The command relies on `futureFlags.affectedUsingTaskInputs`. Without that flag, `doctor` warns, and `affected` runs every file task of an affected package.

### Playwright args for a whole run

`turbo run e2e-ci -- <args>` never reaches the file tasks: turbo forwards args only to tasks you name on the command line. Put Playwright args for every file in `TURBO_ATOMIZER_ARGS` instead:

```sh
TURBO_ATOMIZER_ARGS='--grep @smoke' npx turbo run e2e-ci
```

- The variable is part of every file task's hash, so a filtered run never reuses an unfiltered run's cache entries.
- A value that starts with `[` is read as a JSON array of strings, for args that contain spaces: `TURBO_ATOMIZER_ARGS='["--grep","sign in"]'`. Any other value splits on whitespace. An invalid JSON value fails the run.
- A file that has no test matching a filter still passes. A run that selects zero tests without any filter fails, so a false green is never cached.

`-- <args>` still works when you name a single file task on the command line.

### Run one file or the whole group

`turbo run e2e-ci--all`, or a direct `turbo run e2e-ci--tests/login.spec.ts`, also schedules the generated package's copies of those tasks. The copies exit 0 without running anything, and print:

```text
turbo-atomizer: skipped tests/login.spec.ts in the generated package; add --filter=<test package> to avoid scheduling it
```

Add `--filter=<test package>` to leave them out:

```sh
npx turbo run e2e-ci--tests/login.spec.ts --filter=web-e2e
```

## Commands

All commands except `init` target every package that has an atomizer config. Pass `--package <dir>` to choose one test package. `init` uses the current directory when it holds a Playwright config, or the directory from `--package`.

| Command                                          | What it does                                                                                                         | Exit code                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `init [--package <dir>] [--generated-dir <dir>]` | Sets up a test package. See [Set up a test package](#set-up-a-test-package).                                         | 1 on any error                  |
| `sync [--check]`                                 | Regenerates the file tasks. With `--check`, writes nothing and prints a summary of added, removed and changed tasks. | `--check`: 1 if stale           |
| `doctor`                                         | Checks the setup. See below.                                                                                         | 1 on any error finding          |
| `affected [-- <turbo run args>]`                 | Runs only the affected file tasks.                                                                                   | turbo's, else 0                 |
| `merge-reports`                                  | Merges the per-file blob reports into one report. See below.                                                         | 1 on failures or a missing blob |
| `--version`, `--help`                            | Print the version or the usage text.                                                                                 | 0                               |

An unknown command or option prints the usage text and exits 2.

### `doctor`

`doctor` prints one status line per package, then one line per finding. It exits 1 when any finding is an error.

```text
apps/web-e2e: 1 error, 1 warning
  error stale-generated: The generated file tasks are stale (1 added, 0 removed, 0 changed); run `turbo-atomizer sync`.
  warning setup-projects: Setup projects (setup) run once per spec file, not once per suite.
```

A clean package prints `apps/web-e2e: ok`. Finding codes are stable, so scripts can match on them:

| Code                     | Level   | Meaning                                                                                                                                                                                              |
| ------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stale-generated`        | error   | The generated file differs from what `sync` would write.                                                                                                                                             |
| `helper-missing`         | error   | The Playwright config is not wrapped in `withAtomizer`.                                                                                                                                              |
| `test-turbo-json-drift`  | error   | The test package's `turbo.json` is missing, no longer extends the generated package, or its task no longer depends on `<task>--all`.                                                                 |
| `root-flag-missing`      | error   | The root `turbo.json` lacks `futureFlags.experimentalTaskCommand: true`.                                                                                                                             |
| `affected-flag-missing`  | warning | The root `turbo.json` lacks `futureFlags.affectedUsingTaskInputs: true`.                                                                                                                             |
| `peer-version`           | error   | turbo or Playwright is below the minimum version.                                                                                                                                                    |
| `turbo-untested`         | warning | turbo is outside the tested range.                                                                                                                                                                   |
| `spec-rejected`          | error   | A spec is not matched by `specGlobs`, lies outside the package root, or has a glob character in its path.                                                                                            |
| `server-unshareable`     | error   | A web server entry has neither `url` nor `port`, so file runs cannot share it.                                                                                                                       |
| `app-dependency-missing` | error   | The config has a web server, but no workspace dependency of the test package has a task matched by `dependsOn`. Add the app as a dependency with a build task, or list its sources in `extraInputs`. |
| `outside-import`         | error   | A spec imports a file outside the package that no workspace dependency or `extraInputs` entry covers.                                                                                                |
| `turbo-query-failed`     | error   | `turbo query` failed, so the `app-dependency-missing` and `outside-import` checks did not run.                                                                                                       |
| `setup-projects`         | warning | Setup projects run once per spec file.                                                                                                                                                               |
| `custom-snapshot-path`   | warning | A custom `snapshotPathTemplate` or `snapshotDir` makes snapshots a shared input.                                                                                                                     |
| `custom-reporter`        | warning | A reporter that is not built in gets no per-file output redirect, so it must not write to a fixed path.                                                                                              |

### `merge-reports`

Each file task writes a Playwright blob report to `.atomizer/<slug>/blob.zip`, and turbo caches it with the task. `merge-reports` collects the blobs of the current file tasks and runs `playwright merge-reports` with your configured reporters, so cache-restored files appear in the merged report.

- Run it after the suite, even when the suite failed. It exits 1 when the merged report has failures.
- It exits 1 when a file task ran (its `.atomizer/<slug>/` dir exists) but left no `blob.zip`, because that file crashed before Playwright reported. The blobs that do exist are still merged.
- It warns when some file tasks never ran, so the merged report covers only the files that did. That is expected after `affected` or a filter. When no file task ran at all, it warns and exits 0.
- It warns and exits 0 when the generated `turbo.json` lists no file tasks.
- It exits 1 when the Playwright config is not wrapped in `withAtomizer`, or the generated package has no `turbo.json` (run `sync`).
- It writes a temporary `playwright.atomizer-merge.config.mjs` next to your Playwright config and deletes it afterwards.
- On a developer machine it can merge blobs left by earlier runs of tasks the current run did not select. A fresh CI checkout does not.

## Config reference

Configuration is optional. `init` writes `turbo-atomizer.json` in the test package. As an alternative, use a `"turbo-atomizer"` key in the test package's `package.json`. Having both is an error. With neither, all defaults apply.

Editing the `package.json` key invalidates every file's cache, because turbo always hashes `package.json`. `turbo-atomizer.json` is excluded from the task inputs.

The package validates the config with zod and ships the JSON schema as `turbo-atomizer/schema.json`. Unknown keys are ignored, so a misspelled key has no effect.

```json
{
  "$schema": "../../node_modules/turbo-atomizer/schema.json",
  "generatedPackage": "tools/web-e2e-atoms",
  "failOnFlaky": true
}
```

| Field                | Type        | Default                                                | Meaning                                                                                                                                                                                                                 |
| -------------------- | ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task`               | string      | `"e2e-ci"`                                             | Umbrella task name and the prefix of every task name.                                                                                                                                                                   |
| `generatedPackage`   | string      | `tools/<test-package-dir>-atoms`                       | Path of the generated package, relative to the workspace root. `init` writes it.                                                                                                                                        |
| `playwrightConfig`   | string      | first of `playwright.config.{ts,js,mts,mjs,cts,cjs}`   | Playwright config file name, in the test package root.                                                                                                                                                                  |
| `specGlobs`          | string[]    | `["**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"]` | Spec files, excluded from every task's inputs. Every discovered spec must match one (`sync` and `doctor` check).                                                                                                        |
| `snapshotGlobs`      | string[]    | `["**/*-snapshots/**"]`                                | Snapshot folders, excluded from every task's inputs. A spec's own `<spec>-snapshots/**` reaches its hash through its carrier.                                                                                           |
| `extraInputs`        | string[]    | `[]`                                                   | Copied verbatim into every file task's `inputs`, in turbo glob syntax. Use `$TURBO_ROOT$/…` for files outside the package.                                                                                              |
| `env`                | string[]    | `[]`                                                   | Hashed environment variables, such as a base URL or feature flags. `TURBO_ATOMIZER_ARGS` is always added.                                                                                                               |
| `passThroughEnv`     | string[]    | `[]`                                                   | Environment variables the server or tests need under turbo's strict env mode, without hashing them.                                                                                                                     |
| `dependsOn`          | string[]    | `["^build"]`                                           | Dependencies of every file task.                                                                                                                                                                                        |
| `uncached.patterns`  | string[]    | `[]`                                                   | Globs matched against a spec's path relative to the test package (`tests/checkout.spec.ts`). A match gets `cache: false` and the tag `atomizer:live`.                                                                   |
| `uncached.commitEnv` | string      | unset                                                  | A variable name. When set, matched specs stay cacheable with this variable in `env`, so a result is reused only while the variable holds the same value, for example the commit SHA. They keep the `atomizer:live` tag. |
| `failOnFlaky`        | boolean     | `false`                                                | Adds Playwright's `--fail-on-flaky-tests`, so a pass on retry is not stored.                                                                                                                                            |
| `server.idleMs`      | integer ≥ 0 | `5000`                                                 | The server supervisor stops its web servers after this many milliseconds with no file task connected.                                                                                                                   |

### Environment variables

| Variable                           | Set by   | Meaning                                                                                                                                               |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURBO_ATOMIZER_ARGS`              | you      | Extra Playwright args for every file task.                                                                                                            |
| `TURBO_SCM_BASE`, `TURBO_SCM_HEAD` | you      | Git refs that `affected` compares, as for `turbo --affected`.                                                                                         |
| `TURBO_ATOMIZER`                   | atomizer | `1` in every Playwright run atomizer starts. `withAtomizer` then sets `reuseExistingServer: true` on every web server.                                |
| `TURBO_ATOMIZER_DESCRIBE`          | atomizer | `1` only in the `--list` runs of `sync`, `doctor`, `merge-reports` and the supervisor. `withAtomizer` then publishes the config facts atomizer needs. |

## Retries

Playwright's per-test retries need no package support. Set them in your Playwright config:

```ts
export default withAtomizer(
  defineConfig({
    testDir: './tests',
    retries: 2
  })
);
```

A retry happens inside one file task, so a flaky test costs a rerun of that test, not of the suite. turbo stores a task that passes after a retry. Set `failOnFlaky: true` to keep flaky passes out of the cache.

## Web server

Playwright's `webServer` (a single entry or an array) stays the source of truth. A detached supervisor process starts each server once and shares it between all file tasks that run at the same time. It stops the servers after `server.idleMs` without a connected file task.

- Every entry needs a `url` or a `port`; otherwise it cannot be shared.
- A server that already answers is reused and never stopped.
- A fully cached run starts no file task, so no server starts.
- Give each test package its own port. Two packages that share a port share the first package's server, and it stops when the first supervisor goes idle.
- A server reused from an earlier run inside its idle window, or one you left running, serves the code it started with. Atomizer cannot see that.

## Console contract

Tools that read the task graph, such as Turbo Console, rely on these conventions. They are stable across minor versions; changing one is a major release.

| Item              | Convention                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| File task name    | `<task>--<posix path relative to the test package>`, for example `e2e-ci--tests/login.spec.ts`.                               |
| File task tag     | `atomizer:<task>`, for example `atomizer:e2e-ci`. Identify file tasks by this tag, never by name prefix.                      |
| Live specs        | Also carry `atomizer:live`.                                                                                                   |
| Carrier task      | Named `<task>-src--<posix path relative to the test package>`. Carries `atomizer:carrier` and never `atomizer:<task>`.        |
| Aggregate task    | `<task>--all` depends on every file task, not on carriers.                                                                    |
| Generated package | Carries `atomizer:definitions`. It also lists every file task and carrier, so read file tasks from packages without this tag. |

Read file tasks from `turbo query`, cache state from `turbo run <task> --dry=json`, and last results from `.turbo/runs`. File tasks and carriers both report a cache status in `--dry=json`.

## Correctness rules

A task whose inputs miss a file can replay an old pass after that file changes. These rules come before speed.

- **Inputs.** A file task's inputs are the whole test package minus all specs and snapshot folders, plus its own spec and snapshots through its carrier. New helpers and fixtures are covered without configuration. Editing a spec never replays its old pass.
- **The app under test** and any other outside code reach the hash through workspace dependencies and `dependsOn` tasks, or through `extraInputs`. `doctor` catches a spec import that does neither, and a web server whose app no dependency task covers.
- **Upgrades.** turbo hashes the package's `package.json` and the lockfile, so a Playwright or turbo-atomizer upgrade invalidates every file.
- **Only passes are stored.** A flaky pass is stored unless `failOnFlaky` is set. A run that selects zero tests fails unless you forwarded a filter, so a stale list line (`no tests selected for <path>; run turbo-atomizer sync`) fails and caches nothing.
- **Live-backend specs** are uncached by default. Use `uncached.patterns`.
- **Specs must not depend on each other.** Any order, any concurrency and any subset must work.
- **Stored passes should expire.** Vercel's remote cache expires entries after 7 days; a self-hosted cache needs its own limit.

## Known limits

- **Experimental turbo feature.** See the next section.
- **One Playwright config per package, in the package root.** A config outside the test package root is not supported.
- **Spec paths** may not contain `*`, `?`, `[`, `]`, `{`, `}` or `!`. `sync` rejects them and asks for a rename. Spaces are fine.
- **Setup projects run once per file**, inside each file's Playwright process. Keep them cheap. `doctor` warns about them.
- **Custom `snapshotPathTemplate` or `snapshotDir`** make snapshots a shared input: editing one snapshot reruns every file.
- **`sync` loads your specs**, so workspace packages they import must be built first.
- **`--affected` changes repo-wide.** `futureFlags.affectedUsingTaskInputs` makes every `turbo run --affected` in the repo select tasks by their inputs instead of whole packages.
- **Long `affected` runs.** `affected` names every affected file task on the `turbo run` command line. On Windows, the command-line limit is about 32,000 characters, roughly 800 tasks of 40 characters each.
- **Not supported:** sharding over machines, Cypress or other runners, and writing CI vendor config.

## The experimental-flag risk

turbo-atomizer generates tasks with turbo's `command` field, which turbo gates behind `futureFlags.experimentalTaskCommand`. An experimental flag can change or disappear in any turbo release.

- The peer range is narrow (`>=2.11.7 <2.12.0`). `doctor` warns when turbo is outside it and errors when turbo is below it.
- If turbo drops `command`, the same generator can write scripts into the generated package's `package.json` instead. That fallback is designed (spec section 12) but not built.
- `init` sets two root flags. Both are part of turbo's global hash, so the first run after `init` misses every cache once. `affectedUsingTaskInputs` also changes every `--affected` run in the repo from package-level to task-level selection.

Pin turbo to an exact version in your repo, and upgrade it in its own commit so a breakage has one suspect.

## Per-file start-up cost

Every file task starts its own Playwright process, and runs the setup projects again. That cost is the price of per-file caching.

Measured on the six-file fixture in this repo's e2e suite (one Linux machine, one shared web server):

| Run                | Wall time   |
| ------------------ | ----------- |
| Cold, 6 file tasks | about 2.4 s |
| Fully cached       | about 50 ms |

A cold file task pays for a Playwright process, a browser launch and the setup projects. A cached file task pays for almost nothing. For a large suite, set turbo's `--concurrency` (default 10) near your CPU count. A file runs in one Playwright worker unless the config sets `fullyParallel`.

```sh
npx turbo run e2e-ci --concurrency=4
```

## License

MIT
