import { writeCountFile } from '../data-access/count-file.store.ts';

export const recordSelectedCount = async (file: string, selected: number): Promise<void> => {
  await writeCountFile(file, selected);
};
