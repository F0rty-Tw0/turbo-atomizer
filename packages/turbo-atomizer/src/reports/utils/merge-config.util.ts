type MergeConfig = {
  readonly reporter: [string, unknown][];
  readonly testDir: string;
};

const isNotBlob = (reporter: [string, unknown]): boolean => {
  return reporter[0] !== 'blob';
};

export const renderMergeConfig = (reporters: [string, unknown][], testDir: string): string => {
  const reporter = reporters.filter(isNotBlob);
  const config: MergeConfig = { reporter, testDir };
  const body = JSON.stringify(config, null, 2);

  return `// Written by turbo-atomizer merge-reports and deleted after the merge.\nexport default ${body};\n`;
};
