import type { SelectedCount, ZeroTestVerdict } from '../common/exec.type.ts';

export const zeroTestVerdict = (count: SelectedCount | undefined, hasFilter: boolean): ZeroTestVerdict => {
  if (count === undefined) return 'missing';

  if (count.selected > 0) return 'ok';

  if (hasFilter) return 'ok';

  return 'empty';
};
