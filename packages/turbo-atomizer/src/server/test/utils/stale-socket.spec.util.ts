import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const LISTENER_SOURCE = "require('node:net').createServer().listen(process.argv[1], () => console.log('up'))";

/** Leaves a socket file with no listener behind: a child binds `socketPath`, then dies by SIGKILL before it can unlink. */
export const createStaleSocket = async (socketPath: string): Promise<void> => {
  const child = spawn(process.execPath, ['-e', LISTENER_SOURCE, socketPath], { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  const exited = once(child, 'exit');

  await once(lines, 'line');
  child.kill('SIGKILL');
  await exited;
};
