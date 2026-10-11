import { createHash } from 'node:crypto';

export const toAtomSlug = (taskPath: string): string => {
  const posixPath = taskPath.replaceAll('\\', '/');
  const hash = createHash('sha1').update(posixPath).digest('hex');
  const readablePath = posixPath.replaceAll(/[/.]/g, '-');

  return `${readablePath}-${hash.slice(0, 6)}`;
};
