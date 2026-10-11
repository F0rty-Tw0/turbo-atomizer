import { CONTINUE_FLAG } from '../common/affected.const.ts';

/**
 * Task names of `packageName` among turbo's `<package>#<task>` full names, sorted and deduped. The generated
 * package's copies carry the same tag under another package name, so they drop out (spec §6.6 step 2).
 */
export const selectPackageTasks = (fullNames: string[], packageName: string): string[] => {
  const prefix = `${packageName}#`;
  const own = fullNames.filter((fullName): boolean => fullName.startsWith(prefix));
  const names = own.map((fullName): string => fullName.slice(prefix.length));
  const unique = new Set(names);
  const deduped = [...unique];

  return deduped.toSorted();
};

/** `turbo run` args for the affected file tasks of one test package (spec §6.6 step 4). */
export const toTurboRunArgs = (taskNames: string[], packageName: string, forwarded: string[]): string[] => {
  return [...taskNames, `--filter=${packageName}`, CONTINUE_FLAG, ...forwarded];
};
