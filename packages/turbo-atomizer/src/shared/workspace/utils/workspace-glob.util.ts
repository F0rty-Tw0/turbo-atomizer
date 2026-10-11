const normalizeGlob = (glob: string): string => {
  const withoutDotSlash = glob.replace(/^\.\//, '');

  return withoutDotSlash.replace(/\/+$/, '');
};

const isNegated = (glob: string): boolean => glob.startsWith('!');

const isIncluded = (glob: string): boolean => !isNegated(glob);

const stripNegation = (glob: string): string => normalizeGlob(glob.slice(1));

/** Workspace globs that add packages, without a leading `./` or a trailing `/`. */
export const toIncludeGlobs = (globs: string[]): string[] => globs.filter(isIncluded).map(normalizeGlob);

/** Workspace globs negated with `!`, as positive patterns for an exclude list. */
export const toExcludeGlobs = (globs: string[]): string[] => globs.filter(isNegated).map(stripNegation);
