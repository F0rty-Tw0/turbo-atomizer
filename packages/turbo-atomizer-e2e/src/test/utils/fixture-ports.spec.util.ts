import type { Dirent } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { freePorts } from './free-port.spec.util.ts';
import { MAX_FIXTURE_PORTS, PORT_PLACEHOLDER } from '../common/fixture-workspace.const.ts';

const isFile = (entry: Dirent): boolean => entry.isFile();

const entryPath = (entry: Dirent): string => join(entry.parentPath, entry.name);

const fillFilePorts = async (file: string, ports: number[]): Promise<void> => {
  const text = await readFile(file, 'utf8');

  const portFor = (placeholder: string, index: string): string => {
    const port = ports[Number(index) - 1];

    if (port === undefined) return placeholder;

    return String(port);
  };

  const filled = text.replaceAll(PORT_PLACEHOLDER, portFor);

  if (filled !== text) await writeFile(file, filled);
};

/** Replaces every port placeholder in the copied fixture with a port the OS just handed out. */
export const fillPorts = async (root: string): Promise<void> => {
  const ports = await freePorts(MAX_FIXTURE_PORTS);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter(isFile).map(entryPath);

  await Promise.all(files.map(async (file): Promise<void> => fillFilePorts(file, ports)));
};
