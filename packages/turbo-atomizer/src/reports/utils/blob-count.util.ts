import { ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import type { BlobCollection } from '../common/reports.type.ts';

/** Warns about file tasks that never ran (no `.atomizer/<slug>/`), which an `--affected` or filtered run explains. */
export const blobCountWarning = (blobs: BlobCollection, taskCount: number): string | undefined => {
  const neverRan = taskCount - blobs.copied - blobs.missing.length;

  if (neverRan === 0) return undefined;

  return (
    `turbo-atomizer: ${blobs.copied} of ${taskCount} file tasks left a blob report, so the merged report covers only those files. ` +
    'This is expected after a turbo run with --affected or a filter.'
  );
};

export const missingBlobMessage = (missing: string[]): string => {
  const noun = missing.length === 1 ? 'file task' : 'file tasks';
  const dirs = missing.map((slug): string => `${ATOMIZER_OUTPUT_DIR}/${slug}/`).join(', ');

  return `${missing.length} ${noun} ran but left no blob report, so their results are not in the merged report: ${dirs}`;
};
