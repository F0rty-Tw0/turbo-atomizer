const NODE_MODULES_DIR = 'node_modules';

/** turbo query prints paths with the OS separator; doctor compares posix paths relative to the workspace root. */
export const toPosixPath = (path: string): string => path.replaceAll('\\', '/');

const isWorkspaceFile = (path: string): boolean => !path.split('/').includes(NODE_MODULES_DIR);

/** `paths` as posix paths, `node_modules` files dropped. */
export const toWorkspaceFiles = (paths: string[]): string[] => paths.map(toPosixPath).filter(isWorkspaceFile);
