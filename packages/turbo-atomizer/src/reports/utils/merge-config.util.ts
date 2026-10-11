type MergeConfig = {
  readonly reporter: [string, unknown][];
  readonly testDir: string;
};

const isNotBlob = (reporter: [string, unknown]): boolean => {
  return reporter[0] !== 'blob';
};

/** The user's reporters without blob, then `statusReporter`, which records the merged status merge-reports exits with. */
export const renderMergeConfig = (reporters: [string, unknown][], testDir: string, statusReporter: [string, unknown]): string => {
  const userReporters = reporters.filter(isNotBlob);
  const reporter = [...userReporters, statusReporter];
  const config: MergeConfig = { reporter, testDir };
  const body = JSON.stringify(config, null, 2);

  return `// Written by turbo-atomizer merge-reports and deleted after the merge.\nexport default ${body};\n`;
};
