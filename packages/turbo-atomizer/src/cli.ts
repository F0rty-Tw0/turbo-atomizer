#!/usr/bin/env node
import { affectedHandler } from './affected/feature/affected.handler.ts';
import type { CliCommand } from './cli/common/cli.type.ts';
import { parseCliArgs } from './cli/utils/cli-args.util.ts';
import { getCliVersion } from './config/build-info.ts';
import { resolvePackageTargets } from './shared/workspace/domain-logic/package-targets.ts';

const NO_PACKAGES = 'turbo-atomizer: no test package with an atomizer config found; pass --package <dir>\n';

const runAffected = async (packageDir: string | undefined, forwarded: string[]): Promise<number> => {
  const packageDirs = await resolvePackageTargets(process.cwd(), packageDir);

  if (packageDirs.length === 0) {
    process.stderr.write(NO_PACKAGES);

    return 1;
  }

  return affectedHandler(packageDirs, { forwarded });
};

const runCommand = async (command: CliCommand): Promise<number> => {
  switch (command.command) {
    case 'usage': {
      const stream = command.exitCode === 0 ? process.stdout : process.stderr;

      stream.write(command.message);

      return command.exitCode;
    }

    case 'version':
      process.stdout.write(`${getCliVersion()}\n`);

      return 0;

    case 'affected':
      return runAffected(command.package, command.forwarded);

    case 'init':
    case 'sync':
    case 'doctor':
    case 'merge-reports':
      process.stderr.write(`turbo-atomizer: ${command.command} is not available yet\n`);

      return 1;
  }
};

const setExitCode = (code: number): void => {
  process.exitCode = code;
};

const failCli = (error: unknown): void => {
  process.stderr.write(`turbo-atomizer: ${String(error)}\n`);
  process.exitCode = 1;
};

const command = parseCliArgs(process.argv.slice(2));

runCommand(command).then(setExitCode, failCli);
