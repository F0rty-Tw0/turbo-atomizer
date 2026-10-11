// TEMPORARY CI probe (PR #9, S1): started by Win32_Process.Create, spawns a detached sleeper with stdio to a log, then exits.
const { spawn } = require('node:child_process');
const { closeSync, openSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const log = openSync(join(__dirname, 'hop-child.log'), 'a');
const child = spawn(process.execPath, [join(__dirname, 'sleeper.cjs'), 'hop-child'], {
  detached: true,
  stdio: ['ignore', log, log],
  windowsHide: true
});

child.unref();
closeSync(log);
writeFileSync(join(__dirname, 'hop.json'), JSON.stringify({ hopPid: process.pid, pid: child.pid }));
