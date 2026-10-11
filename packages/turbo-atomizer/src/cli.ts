#!/usr/bin/env node
import { resolve } from 'node:path';

import { affectedHandler } from './affected/feature/affected.handler.ts';
import type { CliCommand } from './cli/common/cli.type.ts';
import { parseCliArgs } from './cli/utils/cli-args.util.ts';
import { getCliVersion } from './config/build-info.ts';
import { initHandler } from './init/feature/init.handler.ts';
import { resolvePackageTargets } from './shared/workspace/domain-logic/package-targets.ts';
import { syncHandler } from './sync/feature/sync.handler.ts';

type PackagesHandler = (packageDirs: string[]) => Promise<number>;

const NO_PACKAGES = 'turbo-atomizer: no test package with an atomizer config found; pass --package <dir>\n';

const runForTargets = async (packageDir: string | undefined, handler: PackagesHandler): Promise<number> => {
  const packageDirs = await resolvePackageTargets(process.cwd(), packageDir);

  if (packageDirs.length === 0) {
    process.stderr.write(NO_PACKAGES);

    return 1;
  }

  return handler(packageDirs);
};

/** init targets one package, the cwd unless --package is given (spec §6). */
const runInit = async (packageDir: string | undefined, generatedDir: string | undefined): Promise<number> => {
  const target = resolve(process.cwd(), packageDir ?? '.');
  const cliVersion = getCliVersion();

  return initHandler([target], { cliVersion, generatedDir });
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

    case 'init':
      return runInit(command.package, command.generatedDir);

    case 'sync': {
      const { check } = command;

      return runForTargets(command.package, async (packageDirs): Promise<number> => syncHandler(packageDirs, { check }));
    }

    case 'affected': {
      const { forwarded } = command;

      return runForTargets(command.package, async (packageDirs): Promise<number> => affectedHandler(packageDirs, { forwarded }));
    }

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
