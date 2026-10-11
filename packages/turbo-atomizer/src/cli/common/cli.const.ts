export const CLI_USAGE = `Usage: turbo-atomizer <command> [options]

Commands:
  init            Set up turbo-atomizer for a test package
  sync            Regenerate the per-spec turbo tasks
  doctor          Check the setup for problems
  merge-reports   Merge the per-spec blob reports into one report

Options:
  --package <dir>         Test package to target (default: every configured package; init: the cwd)
  --generated-dir <dir>   init only: directory of the generated package
  --check                 sync only: exit 1 instead of writing when the generated file is stale
  --version               Print the version
  --help                  Print this help
`;
