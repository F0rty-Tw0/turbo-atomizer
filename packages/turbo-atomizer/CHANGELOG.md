# Changelog

## 0.1.0


_Unreleased._ First release.

### 🚀 Features

- `init` sets up a test package: config, generated package, root future flags, `.gitignore` entries and the test package's `turbo.json`.
- `sync` generates one turbo task and one carrier task per spec file, and `sync --check` fails when they are stale.
- `affected` runs only the affected file tasks.
- `doctor` checks the setup and exits 1 on any error.
- `merge-reports` merges the per-file blob reports into one report and exits 1 when it has failures.
- `withAtomizer` from `turbo-atomizer/playwright` wraps a Playwright config.
- A shared web server serves every concurrent file task.
- `TURBO_ATOMIZER_ARGS` passes Playwright args to every file task.
- `turbo-atomizer/schema.json` describes the config for editors.
