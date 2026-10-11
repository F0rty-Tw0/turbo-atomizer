// TEMPORARY CI probe (PR #9, S1): runs as the web package's build task, so everything here runs inside a turbo task.
// powershell is spawned detached so libuv does not put it in node's own child job; it then reports the job it inherited.
const { spawn } = require('node:child_process');
const { closeSync, existsSync, openSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const outPath = join(__dirname, 'self.json');
const out = openSync(outPath, 'w');
const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'probe.ps1'), 'self'];
const started = Date.now();
const child = spawn('powershell.exe', args, { detached: true, stdio: ['ignore', out, out], windowsHide: true });

child.unref();
closeSync(out);

const end = Date.now() + 120_000;
let text = '';

while (Date.now() < end) {
  text = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';

  if (text.includes('}')) break;

  sleepMs(250);
}

writeFileSync(join(__dirname, 'probe.json'), JSON.stringify({ selfMs: Date.now() - started, self: text }));
