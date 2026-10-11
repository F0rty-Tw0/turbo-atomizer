export const blobCountWarning = (blobCount: number, taskCount: number): string | undefined => {
  if (blobCount === taskCount) return undefined;

  return (
    `turbo-atomizer: ${blobCount} of ${taskCount} file tasks left a blob report, so the merged report covers only those files. ` +
    'This is expected after a turbo run with --affected or a filter.'
  );
};
