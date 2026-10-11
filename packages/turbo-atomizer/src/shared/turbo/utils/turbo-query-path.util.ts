const NODE_MODULES_DIR = 'node_modules';

const WINDOWS_SEPARATOR = '\\';

/**
 * turbo query prints paths with the OS `separator`; doctor compares posix paths relative to the workspace root. Only a
 * Windows separator is rewritten: on POSIX a backslash is a legal file name char.
 */
export const toPosixPath = (path: string, separator: string): string => {
  if (separator !== WINDOWS_SEPARATOR) return path;

  return path.replaceAll(WINDOWS_SEPARATOR, '/');
};

const isWorkspaceFile = (path: string): boolean => !path.split('/').includes(NODE_MODULES_DIR);

/** `paths`, printed with the OS `separator`, as posix paths, `node_modules` files dropped. */
export const toWorkspaceFiles = (paths: string[], separator: string): string[] => {
  const toPosix = (path: string): string => toPosixPath(path, separator);

  return paths.map(toPosix).filter(isWorkspaceFile);
};
