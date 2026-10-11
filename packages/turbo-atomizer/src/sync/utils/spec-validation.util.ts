import { posix } from 'node:path';

type ListLineRule = {
  readonly pattern: RegExp;
  readonly reason: string;
};

// Mirrors loadTestList in playwright/lib/runner/index.js (1.64): lines are trimmed, `#` starts a comment,
// `>`/`›` split title paths, `[` opens a project, and parseLocationArg strips `:<line>[:<column>]`.
const LIST_LINE_RULES: ListLineRule[] = [
  { pattern: /^\[/, reason: 'starts with "["' },
  { pattern: /^#/, reason: 'starts with "#"' },
  { pattern: /[>›]/, reason: 'contains ">" or "›"' },
  { pattern: /:\d+:?\d*$/, reason: 'ends in ":<digits>"' },
  { pattern: /^\s|\s$|[\r\n]/, reason: 'has surrounding whitespace or a line break' }
];

const GLOB_METACHARACTER = /[*?[\]{}!]/;

export const validateListLine = (line: string): string | undefined => {
  const brokenRule = LIST_LINE_RULES.find((rule) => rule.pattern.test(line));

  if (brokenRule === undefined) return undefined;

  return `Playwright --test-list would misparse "${line}" (it ${brokenRule.reason}); rename the spec file.`;
};

export const validateTaskPath = (taskPath: string): string | undefined => {
  const metacharacter = GLOB_METACHARACTER.exec(taskPath)?.[0];

  if (metacharacter === undefined) return undefined;

  return `Spec path "${taskPath}" holds the glob metacharacter "${metacharacter}", so its turbo input would match other files; rename the spec file.`;
};

/** `taskPath` is the posix path relative to the test package (spec §6.2 step 4). */
export const validateSpecLocation = (taskPath: string, specGlobs: string[]): string | undefined => {
  const isAbove = taskPath.startsWith('../');
  const isAbsolute = posix.isAbsolute(taskPath);

  if (isAbove || isAbsolute) return `Spec "${taskPath}" is outside the test package; move it into the package.`;

  const matchesTaskPath = (glob: string): boolean => posix.matchesGlob(taskPath, glob);
  const isMatched = specGlobs.some(matchesTaskPath);

  if (isMatched) return undefined;

  return `Spec "${taskPath}" matches no specGlobs entry; rename the spec file or add a glob to specGlobs.`;
};
